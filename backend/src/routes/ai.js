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

// GET /api/ai/study-context — contexto de estudo personalizado baseado nas provas analisadas
router.get('/study-context', (req, res, next) => {
  try {
    const db = getDb();

    // Buscar todos os tópicos da análise de provas, ordenados por frequência
    const rows = db.prepare(`
      SELECT discipline, topic, frequency, difficulty_avg, patterns
      FROM exam_analysis
      ORDER BY frequency DESC, difficulty_avg DESC
    `).all();

    const profile = db.prepare('SELECT banca FROM user_profile WHERE id = 1').get();
    const banca = profile?.banca || 'Geral';

    if (rows.length === 0) {
      return res.json({ hasAnalysis: false, banca, disciplineSummary: [], topTopics: {} });
    }

    // Agrupar tópicos por disciplina
    const topTopics = {};
    const disciplineAgg = {};

    for (const row of rows) {
      const disc = row.discipline;
      if (!topTopics[disc]) {
        topTopics[disc] = [];
        disciplineAgg[disc] = { discipline: disc, topicCount: 0, totalFrequency: 0 };
      }
      topTopics[disc].push({
        topic: row.topic,
        frequency: row.frequency,
        difficulty: row.difficulty_avg,
      });
      disciplineAgg[disc].topicCount += 1;
      disciplineAgg[disc].totalFrequency += row.frequency || 0;
    }

    // Ordenar disciplinas por frequência total decrescente
    const disciplineSummary = Object.values(disciplineAgg)
      .sort((a, b) => b.totalFrequency - a.totalFrequency);

    res.json({ hasAnalysis: true, banca, disciplineSummary, topTopics });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/pre-reading — gerar conteúdo de pré-leitura
router.post('/pre-reading', async (req, res, next) => {
  try {
    const { discipline, topic, subtopic, sessionId, force_refresh } = req.body;
    if (!discipline || !topic) {
      return res.status(400).json({ error: 'discipline e topic são obrigatórios' });
    }

    const db = getDb();
    const { getDocumentContext } = require('../services/summarizer.service');

    // Buscar perfil do usuário para obter a banca
    const profile = db.prepare('SELECT banca FROM user_profile WHERE id = 1').get();
    const banca = profile?.banca || 'Geral';

    // ── Cache de pré-leitura ──────────────────────────────────────────────────
    // Chave: discipline + topic + subtopic + banca
    // Não reprocessar se já existe conteúdo gerado para este tópico/banca
    if (!force_refresh) {
      const cached = db.prepare(`
        SELECT id, final_content, sources_used, quality_score, generated_at
        FROM content_generations
        WHERE discipline = ? AND topic = ? AND (subtopic IS NULL OR subtopic = ?) AND final_content != ''
        ORDER BY generated_at DESC
        LIMIT 1
      `).get(discipline, topic, subtopic || null);

      if (cached?.final_content) {
        console.log(`[AI] Cache hit pré-leitura: ${discipline} / ${topic} (gerado em ${cached.generated_at})`);

        // Atualizar sessão se fornecida
        if (sessionId) {
          db.prepare('UPDATE study_sessions SET phase = ? WHERE id = ?').run('pre_reading', sessionId);
        }

        // Buscar documentos para retornar nas fontes
        const docs = db.prepare(
          "SELECT original_name, type FROM documents WHERE processed = 1 ORDER BY uploaded_at DESC LIMIT 5"
        ).all() || [];

        let ragSources = [];
        try { ragSources = JSON.parse(cached.sources_used || '[]'); } catch { /* ignore */ }

        let qualityScore = null;
        try { qualityScore = JSON.parse(cached.quality_score || 'null'); } catch { /* ignore */ }

        return res.json({
          content: cached.final_content,
          fromCache: true,
          cachedAt: cached.generated_at,
          pipelineId: cached.id,
          qualityScore,
          stepsCompleted: null,
          discipline,
          topic,
          subtopic,
          sources: [
            ...docs.map(d => ({ name: d.original_name, type: 'document' })),
            ...ragSources.map(s => ({ name: s.title, url: s.url, type: s.source })),
          ],
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Buscar padrões da prova relevantes
    const patterns = db.prepare(
      'SELECT patterns FROM exam_analysis WHERE discipline = ? ORDER BY frequency DESC LIMIT 5'
    ).all(discipline);
    const examPatterns = patterns.flatMap(p => {
      try { return JSON.parse(p.patterns || '[]'); } catch { return []; }
    });

    // Buscar documentos relevantes (IDs e nomes para resposta)
    const documents = db.prepare(
      "SELECT id, original_name, type FROM documents WHERE processed = 1 ORDER BY uploaded_at DESC LIMIT 5"
    ).all() || [];

    // Gerar contexto compactado a partir dos resumos em cache (economia de tokens)
    const examDocIds = documents.filter(d => ['prova', 'gabarito'].includes(d.type)).map(d => d.id);
    const syllabusDocIds = documents.filter(d => ['edital', 'apoio'].includes(d.type)).map(d => d.id);

    const [examContext, syllabusContext] = await Promise.all([
      getDocumentContext(examDocIds, 'exam_analysis'),
      getDocumentContext(syllabusDocIds, 'syllabus'),
    ]);

    // Construir documentContext compactado para o pipeline
    const documentContext = {
      examAnalysis: examContext,
      syllabusAnalysis: syllabusContext,
      draftSupport: await getDocumentContext(documents.map(d => d.id), 'draft_generation'),
    };

    const result = await generatePreReading({
      discipline, topic, subtopic, examPatterns,
      documents, // Ainda passamos os metadados (id, original_name, type) para referência
      documentContext, // Contexto compactado dos resumos — alimenta Steps A, B e C
      sessionId, banca,
    });

    // Atualizar sessão se fornecida
    if (sessionId) {
      db.prepare('UPDATE study_sessions SET phase = ? WHERE id = ?').run('pre_reading', sessionId);
    }

    res.json({ 
      content: result.content, 
      fromCache: false,
      apiWarning: result.apiWarning,
      pipelineId: result.pipelineId || null,
      qualityScore: result.qualityScore || null,
      stepsCompleted: result.stepsCompleted || null,
      discipline, 
      topic, 
      subtopic,
      sources: [
        ...documents.map(d => ({ name: d.original_name, type: 'document' })),
        ...(result.ragSources || []).map(s => ({ name: s.title, url: s.url, type: s.source }))
      ],
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

    // Buscar perfil do usuário para obter a banca
    const profile = db.prepare('SELECT banca FROM user_profile WHERE id = 1').get();
    const banca = profile?.banca || 'Geral';

    // Buscar última prova processada para citar como fonte
    const latestDoc = db.prepare(
      "SELECT original_name FROM documents WHERE type = 'prova' AND processed = 1 ORDER BY uploaded_at DESC LIMIT 1"
    ).get();
    const defaultSource = latestDoc ? `ai:${latestDoc.original_name}` : 'ai';

    // Buscar resumo compactado das provas para passar ao gerador de questões
    const examDocs = db.prepare(
      "SELECT id FROM documents WHERE type IN ('prova', 'gabarito') AND processed = 1 ORDER BY uploaded_at DESC LIMIT 3"
    ).all();
    const { getDocumentContext } = require('../services/summarizer.service');
    const examContext = await getDocumentContext(examDocs.map(d => d.id), 'exam_analysis').catch(() => '');

    const result = await generateQuestions({ discipline, topic, content, count, examPatterns, difficulty, banca, examContext });

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

// POST /api/ai/analyze-exams — analisar provas enviadas (com cache)
router.post('/analyze-exams', async (req, res, next) => {
  try {
    const db = getDb();
    const docs = db.prepare(
      "SELECT id, text_content FROM documents WHERE type IN ('prova', 'gabarito') AND processed = 1 ORDER BY id ASC"
    ).all();

    if (docs.length === 0) {
      return res.status(400).json({ error: 'Nenhuma prova enviada ainda. Faça upload das provas primeiro.' });
    }

    // Gerar hash simples e determinístico dos IDs dos documentos
    const docIds = docs.map(d => d.id).sort().join('|');
    let hashValue = 0;
    for (let i = 0; i < docIds.length; i++) {
      hashValue = (Math.imul(31, hashValue) + docIds.charCodeAt(i)) | 0;
    }
    const docIdsHash = Math.abs(hashValue).toString(36) + '_' + docs.length;

    // Verificar cache
    const cached = db.prepare('SELECT analysis_json FROM exam_analysis_cache WHERE doc_ids_hash = ?').get(docIdsHash);
    if (cached) {
      console.log(`[AI] Cache hit para análise de provas (hash: ${docIdsHash})`);
      return res.json({ ...JSON.parse(cached.analysis_json), fromCache: true });
    }

    // Cache miss — chamar a IA
    console.log(`[AI] Cache miss — analisando provas com IA (hash: ${docIdsHash})`);
    const examTexts = docs.map(d => d.text_content || '').filter(Boolean);
    const analysis = await analyzeExamPapers({ examTexts });

    // Persistir no cache
    db.prepare(`
      INSERT OR REPLACE INTO exam_analysis_cache (doc_ids_hash, analysis_json, doc_count)
      VALUES (?, ?, ?)
    `).run(docIdsHash, JSON.stringify(analysis), docs.length);

    // Salvar análise no banco de tópicos
    if (analysis.topTopics) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO exam_analysis (discipline, topic, frequency, difficulty_avg, patterns)
        VALUES (?, ?, ?, ?, ?)
      `);
      analysis.topTopics.forEach(t => {
        insert.run(t.discipline, t.topic, t.frequency, t.difficulty, JSON.stringify(analysis.patterns || []));
      });
    }

    // Se detectou a banca, salvar no perfil
    if (analysis.detectedBanca) {
      db.prepare('UPDATE user_profile SET banca = ? WHERE id = 1').run(analysis.detectedBanca);
      console.log(`[AI] Banca detectada e salva no perfil: ${analysis.detectedBanca}`);
    }

    res.json({ ...analysis, fromCache: false });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ai/analyze-exams/cache — invalidar cache de análise manualmente
router.delete('/analyze-exams/cache', (req, res, next) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM exam_analysis_cache').run();
    console.log(`[AI] Cache de análise invalidado (${result.changes} entradas removidas)`);
    res.json({ success: true, removed: result.changes });
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

// GET /api/ai/generation/:id — consultar auditoria de uma geração específica
router.get('/generation/:id', (req, res, next) => {
  try {
    const db = getDb();
    const gen = db.prepare('SELECT * FROM content_generations WHERE id = ?').get(req.params.id);
    if (!gen) return res.status(404).json({ error: 'Geração não encontrada' });

    res.json({
      id: gen.id,
      sessionId: gen.session_id,
      discipline: gen.discipline,
      topic: gen.topic,
      subtopic: gen.subtopic,
      modelUsed: gen.model_used,
      pipelineSteps: JSON.parse(gen.pipeline_steps || '[]'),
      sourcesUsed: JSON.parse(gen.sources_used || '[]'),
      qualityScore: JSON.parse(gen.quality_score || 'null'),
      durationMs: gen.duration_ms,
      hadRevisionIssues: gen.had_revision_issues === 1,
      generatedAt: gen.generated_at,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
