const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { getDisciplineForDay } = require('../services/calendar.service');

// POST /api/sessions/start — iniciar sessão de estudo
router.post('/start', (req, res, next) => {
  try {
    const { discipline, topic } = req.body;
    const db = getDb();

    const weights = JSON.parse(
      db.prepare('SELECT discipline_weights FROM user_profile WHERE id = 1').get()?.discipline_weights
      || '{"legislacao":40,"logica":35,"matematica":25}'
    );

    const activeDiscipline = discipline || getDisciplineForDay(new Date(), weights);
    const activeTopic = topic || getDefaultTopic(activeDiscipline);

    const id = uuidv4();
    const date = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO study_sessions (id, date, discipline, topic, phase, status)
      VALUES (?, ?, ?, ?, 'pre_reading', 'active')
    `).run(id, date, activeDiscipline, activeTopic);

    res.json({ sessionId: id, discipline: activeDiscipline, topic: activeTopic, date });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/complete — finalizar sessão
router.post('/:id/complete', (req, res, next) => {
  try {
    const { xpEarned = 0, durationSeconds = 0, answersData } = req.body;
    const db = getDb();

    const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

    db.prepare(`
      UPDATE study_sessions
      SET completed_at = datetime('now'), duration_seconds = ?, xp_earned = ?, status = 'completed', phase = 'done'
      WHERE id = ?
    `).run(durationSeconds, xpEarned, req.params.id);

    // Atualizar XP e streak
    const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
    const today = new Date().toISOString().split('T')[0];
    const lastStudy = profile.last_study_date;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let newStreak = profile.streak || 0;
    if (lastStudy === yesterday) {
      newStreak = newStreak + 1;
    } else if (lastStudy !== today) {
      newStreak = 1;
    }
    const longestStreak = Math.max(newStreak, profile.longest_streak || 0);

    const newXP = (profile.xp || 0) + xpEarned;
    const newLevel = Math.floor(newXP / 500) + 1;

    db.prepare(`
      UPDATE user_profile
      SET xp = ?, level = ?, streak = ?, longest_streak = ?, last_study_date = ?
      WHERE id = 1
    `).run(newXP, newLevel, newStreak, longestStreak, today);

    // Log diário
    const existing = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(today);
    if (existing) {
      db.prepare(`
        UPDATE daily_logs SET studied = 1, sessions_count = sessions_count + 1, xp_earned = xp_earned + ? WHERE date = ?
      `).run(xpEarned, today);
    } else {
      db.prepare(`
        INSERT INTO daily_logs (date, studied, sessions_count, xp_earned) VALUES (?, 1, 1, ?)
      `).run(today, xpEarned);
    }

    // Verificar badges
    const badgesEarned = checkAndAwardBadges(db, { newStreak, newXP, newLevel, session });

    res.json({
      success: true,
      xpEarned,
      newTotalXP: newXP,
      newLevel,
      streak: newStreak,
      longestStreak,
      badgesEarned,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/answer — registrar resposta
router.post('/:id/answer', (req, res, next) => {
  try {
    const { questionId, selectedAnswer, timeTaken = 0 } = req.body;
    const db = getDb();

    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
    if (!question) return res.status(404).json({ error: 'Questão não encontrada' });

    const isCorrect = selectedAnswer === question.correct_answer;
    const answerId = uuidv4();

    db.prepare(`
      INSERT INTO user_answers (id, question_id, session_id, selected_answer, is_correct, time_taken_seconds)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(answerId, questionId, req.params.id, selectedAnswer, isCorrect ? 1 : 0, timeTaken);

    // Atualizar dificuldade do tópico
    db.prepare(`
      INSERT INTO topic_difficulty (discipline, topic, subtopic, error_count, attempt_count, last_seen)
      VALUES (?, ?, NULL, ?, 1, date('now'))
      ON CONFLICT(discipline, topic, subtopic) DO UPDATE SET
        error_count = error_count + ?,
        attempt_count = attempt_count + 1,
        last_seen = date('now')
    `).run(question.discipline, question.topic, isCorrect ? 0 : 1, isCorrect ? 0 : 1);

    // XP por acerto
    const xpGained = isCorrect ? 10 : 0;
    if (xpGained > 0) {
      const profile = db.prepare('SELECT xp FROM user_profile WHERE id = 1').get();
      db.prepare('UPDATE user_profile SET xp = ? WHERE id = 1').run((profile?.xp || 0) + xpGained);
    }

    res.json({
      isCorrect,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      xpGained,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/today — sessão de hoje
router.get('/today', (req, res, next) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    const session = db.prepare(`
      SELECT * FROM study_sessions WHERE date = ? ORDER BY started_at DESC LIMIT 1
    `).get(today);

    const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
    const weights = JSON.parse(profile?.discipline_weights || '{"legislacao":40,"logica":35,"matematica":25}');
    const suggestedDiscipline = getDisciplineForDay(new Date(), weights);

    res.json({
      session: session || null,
      suggestedDiscipline,
      suggestedTopic: getDefaultTopic(suggestedDiscipline),
      alreadyStudied: !!session,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/history — histórico
router.get('/history', (req, res, next) => {
  try {
    const db = getDb();
    const sessions = db.prepare(`
      SELECT * FROM study_sessions ORDER BY started_at DESC LIMIT 50
    `).all();
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/weak-topics — tópicos problemáticos
router.get('/weak-topics', (req, res, next) => {
  try {
    const db = getDb();
    const topics = db.prepare(`
      SELECT discipline, topic, error_count, attempt_count,
             ROUND(CAST(error_count AS FLOAT) / attempt_count * 100, 1) as error_rate
      FROM topic_difficulty
      WHERE attempt_count > 0
      ORDER BY error_rate DESC
      LIMIT 10
    `).all();
    res.json(topics);
  } catch (err) {
    next(err);
  }
});

function getDefaultTopic(discipline) {
  const topics = {
    legislacao: 'LGPD — Lei Geral de Proteção de Dados Pessoais',
    logica: 'Lógica Proposicional',
    matematica: 'Porcentagem e Razão Proporcional',
    informatica: 'Segurança da Informação',
    portugues: 'Interpretação de Texto',
  };
  return topics[discipline] || 'Revisão Geral';
}

function checkAndAwardBadges(db, { newStreak, newXP, newLevel, session }) {
  const badgesEarned = [];
  const now = new Date().toISOString();

  const badgeDefs = [
    { key: 'first_study', name: '🎯 Primeira Sessão', description: 'Completou a primeira sessão de estudos!' },
    { key: 'streak_3', name: '🔥 Sequência de 3', description: '3 dias consecutivos de estudo', condition: newStreak >= 3 },
    { key: 'streak_7', name: '⚡ Sequência de 7', description: '7 dias consecutivos de estudo', condition: newStreak >= 7 },
    { key: 'streak_15', name: '🏆 Persistente', description: '15 dias consecutivos de estudo', condition: newStreak >= 15 },
    { key: 'level_5', name: '⭐ Nível 5', description: 'Atingiu o nível 5!', condition: newLevel >= 5 },
    { key: 'xp_500', name: '💎 500 XP', description: 'Acumulou 500 XP', condition: newXP >= 500 },
    { key: 'xp_2000', name: '👑 2000 XP', description: 'Acumulou 2000 XP', condition: newXP >= 2000 },
  ];

  for (const badge of badgeDefs) {
    if (badge.condition === undefined || badge.condition) {
      const existing = db.prepare('SELECT id FROM badges WHERE badge_key = ?').get(badge.key);
      if (!existing) {
        db.prepare(`
          INSERT OR IGNORE INTO badges (id, badge_key, name, description, earned_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), badge.key, badge.name, badge.description, now);
        badgesEarned.push(badge);
      }
    }
  }

  return badgesEarned;
}

module.exports = router;
