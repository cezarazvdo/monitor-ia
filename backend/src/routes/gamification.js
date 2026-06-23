const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { getRemainingWorkdays, getMonthCalendar } = require('../services/calendar.service');

// GET /api/gamification/profile — perfil completo do usuário
router.get('/profile', (req, res, next) => {
  try {
    const db = getDb();
    const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
    const badges = db.prepare('SELECT * FROM badges ORDER BY earned_at DESC').all();

    const examDate = process.env.EXAM_DATE || profile?.exam_date || '2026-10-19';
    const remainingDays = getRemainingWorkdays(examDate);

    const weights = JSON.parse(profile?.discipline_weights || '{"legislacao":40,"logica":35,"matematica":25}');
    const xpToNextLevel = ((profile?.level || 1) * 500) - (profile?.xp || 0);
    const levelProgress = Math.min(100, Math.max(0, ((profile?.xp || 0) % 500) / 500 * 100));

    res.json({
      name: profile?.name || 'Estudante',
      xp: profile?.xp || 0,
      level: profile?.level || 1,
      streak: profile?.streak || 0,
      longestStreak: profile?.longest_streak || 0,
      lastStudyDate: profile?.last_study_date,
      disciplineWeights: weights,
      examDate,
      remainingWorkdays: remainingDays,
      badges,
      xpToNextLevel: Math.max(0, xpToNextLevel),
      levelProgress,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/gamification/profile — atualizar perfil
router.put('/profile', (req, res, next) => {
  try {
    const { name, disciplineWeights, examDate } = req.body;
    const db = getDb();

    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (disciplineWeights) { updates.push('discipline_weights = ?'); values.push(JSON.stringify(disciplineWeights)); }
    if (examDate) { updates.push('exam_date = ?'); values.push(examDate); }

    if (updates.length > 0) {
      db.prepare(`UPDATE user_profile SET ${updates.join(', ')} WHERE id = 1`).run(...values);
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/gamification/stats — estatísticas detalhadas
router.get('/stats', (req, res, next) => {
  try {
    const db = getDb();

    // Desempenho por disciplina
    const byDiscipline = db.prepare(`
      SELECT q.discipline,
             COUNT(ua.id) as total,
             SUM(ua.is_correct) as correct,
             AVG(ua.time_taken_seconds) as avg_time
      FROM user_answers ua
      JOIN questions q ON ua.question_id = q.id
      GROUP BY q.discipline
    `).all();

    // Últimos 14 dias
    const dailyData = db.prepare(`
      SELECT date, studied, xp_earned, questions_answered, correct_answers
      FROM daily_logs
      ORDER BY date DESC
      LIMIT 14
    `).all();

    // Tópicos mais errados
    const weakTopics = db.prepare(`
      SELECT discipline, topic,
             error_count, attempt_count,
             ROUND(CAST(error_count AS FLOAT) / attempt_count * 100, 1) as error_rate
      FROM topic_difficulty
      WHERE attempt_count >= 2
      ORDER BY error_rate DESC
      LIMIT 8
    `).all();

    // Questões respondidas hoje
    const today = new Date().toISOString().split('T')[0];
    const todayAnswers = db.prepare(`
      SELECT COUNT(*) as total, SUM(is_correct) as correct
      FROM user_answers
      WHERE DATE(answered_at) = ?
    `).get(today);

    // Total geral
    const totals = db.prepare(`
      SELECT COUNT(*) as totalSessions,
             SUM(duration_seconds) as totalSeconds
      FROM study_sessions
      WHERE status = 'completed'
    `).get();

    res.json({
      byDiscipline: byDiscipline.map(d => ({
        discipline: d.discipline,
        total: d.total,
        correct: d.correct || 0,
        rate: d.total > 0 ? Math.round((d.correct || 0) / d.total * 100) : 0,
        avgTime: Math.round(d.avg_time || 0),
      })),
      dailyData: dailyData.reverse(),
      weakTopics,
      todayAnswers: {
        total: todayAnswers?.total || 0,
        correct: todayAnswers?.correct || 0,
      },
      totals: {
        sessions: totals?.totalSessions || 0,
        studyHours: Math.round((totals?.totalSeconds || 0) / 3600 * 10) / 10,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/gamification/calendar?year=&month= — calendário
router.get('/calendar', (req, res, next) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);

    const db = getDb();
    const studiedDatesRows = db.prepare(
      `SELECT DISTINCT date FROM daily_logs WHERE studied = 1 AND strftime('%Y', date) = ? AND strftime('%m', date) = ?`
    ).all(String(year), String(month).padStart(2, '0')) || [];

    const studiedSet = studiedDatesRows.map(d => d.date);
    const calendar = getMonthCalendar(year, month, studiedSet);

    const profile = db.prepare('SELECT exam_date FROM user_profile WHERE id = 1').get();
    const examDate = process.env.EXAM_DATE || profile?.exam_date || '2026-10-19';

    res.json({
      year,
      month,
      days: calendar,
      examDate,
      remainingWorkdays: getRemainingWorkdays(examDate),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
