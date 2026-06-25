const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const {
  generatePreReading,
  generateQuestions,
  generateErrorExplanation,
  analyzeExamPapers,
  fixMermaidDiagram,
} = require('../services/gemini.service');

// POST /api/ai/pre-reading — gerar conteúdo de pré-leitura
router.post('/pre-reading', async (req, res, next) => {
  try {
    const { discipline, topic, subtopic, sessionId } = req.body;
    if (!discipline || !topic) {
      return res.status(400).json({ error: 'discipline e topic são obrigatórios' });
    }

    const db = getDb();

    // Buscar padrões da prova relevantes
    const patterns = db.prepare(
      'SELECT patterns FROM exam_analysis WHERE discipline = ? ORDER BY frequency DESC LIMIT 5'
    ).all(discipline);
    const examPatterns = patterns.flatMap(p => {
      try { return JSON.parse(p.patterns || '[]'); } catch { return []; }
    });

    // Buscar documentos relevantes
    const documents = db.prepare(
      "SELECT id, original_name, text_content FROM documents WHERE processed = 1 ORDER BY uploaded_at DESC LIMIT 3"
    ).all() || [];

    const result = await generatePreReading({ discipline, topic, subtopic, examPatterns, documents });

    // Atualizar sessão se fornecida
    if (sessionId) {
      db.prepare('UPDATE study_sessions SET phase = ? WHERE id = ?').run('pre_reading', sessionId);
    }

    res.json({ 
      content: result.content, 
      apiWarning: result.apiWarning,
      discipline, 
      topic, 
      subtopic,
      sources: documents.map(d => ({ name: d.original_name, type: 'document' }))
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/questions — gerar questões
router.post('/questions', async (req, res, next) => {
  try {
    const { discipline, topic, content, count = 10, sessionId, difficulty = 2 } = req.body;
    if (!discipline || !topic) {
      return res.status(400).json({ error: 'discipline e topic são obrigatórios' });
    }

    const db = getDb();

    // Padrões das provas
    const patterns = db.prepare(
      'SELECT patterns FROM exam_analysis WHERE discipline = ? ORDER BY frequency DESC LIMIT 3'
    ).all(discipline);
    const examPatterns = patterns.flatMap(p => {
      try { return JSON.parse(p.patterns || '[]'); } catch { return []; }
    });

    // Buscar última prova processada para citar como fonte
    const latestDoc = db.prepare(
      "SELECT original_name FROM documents WHERE type = 'prova' AND processed = 1 ORDER BY uploaded_at DESC LIMIT 1"
    ).get();
    const defaultSource = latestDoc ? `ai:${latestDoc.original_name}` : 'ai';

    const result = await generateQuestions({ discipline, topic, content, count, examPatterns, difficulty });

    // Salvar questões no banco
    const savedQuestions = result.questions.map(q => {
      const id = uuidv4();
      const sourceVal = q.source || defaultSource;
      db.prepare(`
        INSERT INTO questions (id, session_id, discipline, topic, stem, options, correct_answer, explanation, difficulty, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, sessionId || null, discipline, topic,
        q.stem, JSON.stringify(q.options), q.correct, q.explanation, q.difficulty || difficulty,
        sourceVal
      );
      return { ...q, id, source: sourceVal };
    });

    res.json({ questions: savedQuestions, count: savedQuestions.length, apiWarning: result.apiWarning });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/explain-error — explicar erro
router.post('/explain-error', async (req, res, next) => {
  try {
    const { questionId, userAnswer, discipline } = req.body;
    const db = getDb();

    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
    if (!question) return res.status(404).json({ error: 'Questão não encontrada' });

    question.options = JSON.parse(question.options || '{}');
    const explanation = await generateErrorExplanation({
      question,
      userAnswer,
      correctAnswer: question.correct_answer,
      discipline: discipline || question.discipline,
    });

    res.json({ explanation });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/analyze-exams — analisar provas enviadas
router.post('/analyze-exams', async (req, res, next) => {
  try {
    const db = getDb();
    const docs = db.prepare(
      "SELECT text_content FROM documents WHERE type IN ('prova', 'gabarito') AND processed = 1"
    ).all();

    if (docs.length === 0) {
      return res.status(400).json({ error: 'Nenhuma prova enviada ainda. Faça upload das provas primeiro.' });
    }

    const examTexts = docs.map(d => d.text_content || '').filter(Boolean);
    const analysis = await analyzeExamPapers({ examTexts });

    // Salvar análise no banco
    if (analysis.topTopics) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO exam_analysis (discipline, topic, frequency, difficulty_avg, patterns)
        VALUES (?, ?, ?, ?, ?)
      `);
      analysis.topTopics.forEach(t => {
        insert.run(t.discipline, t.topic, t.frequency, t.difficulty, JSON.stringify(analysis.patterns || []));
      });
    }

    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/fix-mermaid — corrigir código Mermaid quebrado
router.post('/fix-mermaid', async (req, res, next) => {
  try {
    const { chart } = req.body;
    if (!chart) {
      return res.status(400).json({ error: 'O parâmetro chart é obrigatório' });
    }
    const result = await fixMermaidDiagram(chart);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
