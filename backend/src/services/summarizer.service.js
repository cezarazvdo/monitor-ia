/**
 * summarizer.service.js — Serviço de sumarização de documentos.
 * Gera resumos estruturados dos documentos via IA e os armazena em cache
 * na tabela `document_summaries` para economizar tokens nas chamadas posteriores.
 */
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

// ── Prompts por tipo de documento ───────────────────────────────────────────

const SUMMARY_PROMPTS = {
  prova: (text, docName) => `Analise o texto extraído da prova de concurso "${docName}" e gere um resumo estruturado COMPACTO.

=== TEXTO DA PROVA ===
${text}

Retorne JSON com:
{
  "documentName": "${docName}",
  "documentType": "prova",
  "examPatterns": ["padrão de questão 1", "padrão 2"],
  "questionStyles": ["estilo 1 (ex: assertiva V/F)", "estilo 2"],
  "topicFrequency": [{"topic": "LGPD", "count": 3}, {"topic": "Lógica", "count": 2}],
  "difficultyProfile": "intermediário a avançado",
  "detectedBanca": "CESPE ou FGV ou FCC ou Vunesp ou Não identificada",
  "keyInsights": ["insight conciso 1", "insight 2", "insight 3"]
}

REGRAS: Seja CONCISO. Máximo 5 itens por array. Responda APENAS com o JSON.`,

  gabarito: (text, docName) => `Analise o texto extraído do gabarito "${docName}" e gere um resumo estruturado COMPACTO.

=== TEXTO DO GABARITO ===
${text}

Retorne JSON com:
{
  "documentName": "${docName}",
  "documentType": "gabarito",
  "correctPatterns": ["padrão de respostas corretas 1", "padrão 2"],
  "commonTraps": ["pegadinha comum 1", "pegadinha 2"],
  "topicDistribution": [{"topic": "tema", "questionCount": 5}],
  "keyInsights": ["insight conciso 1", "insight 2"]
}

REGRAS: Seja CONCISO. Máximo 5 itens por array. Responda APENAS com o JSON.`,

  edital: (text, docName) => `Analise o texto extraído do edital "${docName}" e gere um resumo estruturado COMPACTO do conteúdo programático.

=== TEXTO DO EDITAL ===
${text}

Retorne JSON com:
{
  "documentName": "${docName}",
  "documentType": "edital",
  "syllabus": ["item programático 1", "item 2", "item 3"],
  "requirements": ["requisito 1", "requisito 2"],
  "topicHierarchy": [{"discipline": "Legislação", "topics": ["LGPD", "Marco Civil"]}],
  "keyInsights": ["insight conciso 1", "insight 2"]
}

REGRAS: Seja CONCISO. Máximo 8 itens no syllabus, 5 em outros arrays. Responda APENAS com o JSON.`,

  apoio: (text, docName) => `Analise o texto do material de apoio "${docName}" e gere um resumo estruturado COMPACTO.

=== TEXTO DO MATERIAL ===
${text}

Retorne JSON com:
{
  "documentName": "${docName}",
  "documentType": "apoio",
  "keyConcepts": ["conceito-chave 1", "conceito 2", "conceito 3"],
  "legalRefs": ["Lei nº X/YYYY, art. Z", "outra referência"],
  "definitions": [{"term": "termo", "definition": "definição concisa"}],
  "keyInsights": ["insight conciso 1", "insight 2"]
}

REGRAS: Seja CONCISO. Máximo 5 itens por array. Responda APENAS com o JSON.`,
};

// ── Funções principais ──────────────────────────────────────────────────────

/**
 * Gera o resumo estruturado de um documento e salva no cache.
 * @param {string} documentId
 * @returns {Promise<object>} O resumo estruturado salvo
 */
async function summarizeDocument(documentId) {
  const db = getDb();

  const doc = db.prepare(
    'SELECT id, original_name, type, text_content FROM documents WHERE id = ? AND processed = 1'
  ).get(documentId);

  if (!doc || !doc.text_content) {
    throw new Error(`Documento ${documentId} não encontrado ou não processado`);
  }

  // Determinar tipo de prompt
  const docType = doc.type || 'apoio';
  const promptFn = SUMMARY_PROMPTS[docType] || SUMMARY_PROMPTS.apoio;

  // Limitar texto para sumarização (usar mais que o slice antigo, pois é uma vez só)
  const maxChars = 8000;
  const textForSummary = doc.text_content.slice(0, maxChars);

  // Gerar resumo via IA
  let structuredSummary;
  try {
    const GeminiProvider = require('./providers/llm/GeminiProvider');
    const llm = new GeminiProvider();

    if (!llm.isConfigured()) {
      // Sem API key — gerar resumo local básico (fallback)
      structuredSummary = generateLocalSummary(doc, docType);
    } else {
      const prompt = promptFn(textForSummary, doc.original_name);
      structuredSummary = await llm.generateJSON(prompt, { purpose: 'document_summarization' });
    }
  } catch (err) {
    console.warn(`[SUMMARIZER] Falha ao sumarizar via IA (${doc.original_name}):`, err.message);
    structuredSummary = generateLocalSummary(doc, docType);
  }

  // Extrair key_topics do resumo
  const keyTopics = extractKeyTopics(structuredSummary);
  const summaryText = JSON.stringify(structuredSummary);

  // Salvar no cache
  const summaryId = uuidv4();
  const summaryType = mapDocTypeToSummaryType(docType);

  // Remover resumo anterior se existir
  db.prepare('DELETE FROM document_summaries WHERE document_id = ?').run(documentId);

  db.prepare(`
    INSERT INTO document_summaries (id, document_id, summary_type, structured_summary, key_topics, char_count, original_char_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    summaryId,
    documentId,
    summaryType,
    summaryText,
    JSON.stringify(keyTopics),
    summaryText.length,
    doc.text_content.length
  );

  console.log(`[SUMMARIZER] Resumo gerado: ${doc.original_name} (${doc.text_content.length} → ${summaryText.length} chars, economia: ${Math.round((1 - summaryText.length / doc.text_content.length) * 100)}%)`);

  return structuredSummary;
}

/**
 * Retorna o resumo do cache ou gera sob demanda.
 * @param {string} documentId
 * @returns {Promise<object>} Resumo estruturado
 */
async function getOrCreateSummary(documentId) {
  const db = getDb();

  // Tentar cache primeiro
  const cached = db.prepare(
    'SELECT structured_summary FROM document_summaries WHERE document_id = ?'
  ).get(documentId);

  if (cached) {
    try {
      return JSON.parse(cached.structured_summary);
    } catch {
      // Cache corrompido — regenerar
    }
  }

  // Gerar sob demanda
  return summarizeDocument(documentId);
}

/**
 * Invalida o cache de resumo de um documento.
 * @param {string} documentId
 */
function invalidateSummary(documentId) {
  const db = getDb();
  db.prepare('DELETE FROM document_summaries WHERE document_id = ?').run(documentId);
  console.log(`[SUMMARIZER] Cache invalidado para documento ${documentId}`);
}

/**
 * Retorna contexto compactado de múltiplos documentos, pronto para uso nos prompts.
 * @param {string[]} documentIds - IDs dos documentos
 * @param {string} purpose - 'exam_analysis' | 'syllabus' | 'draft_generation' | 'pre_reading'
 * @returns {Promise<string>} Texto compactado para inclusão no prompt
 */
async function getDocumentContext(documentIds, purpose) {
  if (!documentIds || documentIds.length === 0) return '';

  const summaries = [];
  for (const docId of documentIds) {
    try {
      const summary = await getOrCreateSummary(docId);
      summaries.push(summary);
    } catch (err) {
      console.warn(`[SUMMARIZER] Não foi possível obter resumo de ${docId}:`, err.message);
    }
  }

  if (summaries.length === 0) return '';

  return formatContextForPurpose(summaries, purpose);
}

// ── Helpers internos ────────────────────────────────────────────────────────

/**
 * Gera resumo local básico sem IA (fallback quando API key está ausente).
 */
function generateLocalSummary(doc, docType) {
  const text = doc.text_content || '';
  // Extrair primeiras linhas significativas
  const lines = text.split(/\n+/).filter(l => l.trim().length > 10).slice(0, 15);

  return {
    documentName: doc.original_name,
    documentType: docType,
    keyInsights: lines.slice(0, 5).map(l => l.trim().slice(0, 120)),
    keyConcepts: [],
    legalRefs: [],
    _source: 'local_fallback',
  };
}

/**
 * Extrai tópicos-chave de um resumo estruturado.
 */
function extractKeyTopics(summary) {
  const topics = new Set();

  // Extrair de topicFrequency
  if (summary.topicFrequency) {
    summary.topicFrequency.forEach(t => topics.add(t.topic));
  }
  // Extrair de topicHierarchy
  if (summary.topicHierarchy) {
    summary.topicHierarchy.forEach(h => {
      if (h.topics) h.topics.forEach(t => topics.add(t));
    });
  }
  // Extrair de topicDistribution
  if (summary.topicDistribution) {
    summary.topicDistribution.forEach(t => topics.add(t.topic));
  }
  // Extrair de keyConcepts
  if (summary.keyConcepts) {
    summary.keyConcepts.forEach(c => topics.add(c));
  }

  return [...topics].slice(0, 10);
}

/**
 * Mapeia tipo de documento para tipo de resumo.
 */
function mapDocTypeToSummaryType(docType) {
  const map = {
    prova: 'exam_context',
    gabarito: 'exam_context',
    edital: 'syllabus_context',
    apoio: 'support_context',
  };
  return map[docType] || 'support_context';
}

/**
 * Formata os resumos de acordo com o propósito de uso.
 */
function formatContextForPurpose(summaries, purpose) {
  switch (purpose) {
    case 'exam_analysis':
      return summaries.map((s, i) => {
        const parts = [`=== RESUMO DA PROVA ${i + 1}: ${s.documentName || 'Documento'} ===`];
        if (s.examPatterns) parts.push(`Padrões: ${s.examPatterns.join('; ')}`);
        if (s.questionStyles) parts.push(`Estilos de questão: ${s.questionStyles.join('; ')}`);
        if (s.topicFrequency) parts.push(`Tópicos: ${s.topicFrequency.map(t => `${t.topic}(×${t.count})`).join(', ')}`);
        if (s.detectedBanca) parts.push(`Banca detectada: ${s.detectedBanca}`);
        if (s.difficultyProfile) parts.push(`Perfil de dificuldade: ${s.difficultyProfile}`);
        if (s.correctPatterns) parts.push(`Padrões corretos: ${s.correctPatterns.join('; ')}`);
        if (s.commonTraps) parts.push(`Pegadinhas comuns: ${s.commonTraps.join('; ')}`);
        if (s.keyInsights) parts.push(`Insights: ${s.keyInsights.join('; ')}`);
        return parts.join('\n');
      }).join('\n\n');

    case 'syllabus':
      return summaries.map((s, i) => {
        const parts = [`=== RESUMO DO EDITAL ${i + 1}: ${s.documentName || 'Documento'} ===`];
        if (s.syllabus) parts.push(`Conteúdo programático: ${s.syllabus.join('; ')}`);
        if (s.requirements) parts.push(`Requisitos: ${s.requirements.join('; ')}`);
        if (s.topicHierarchy) {
          const hierarchy = s.topicHierarchy.map(h => `${h.discipline}: ${(h.topics || []).join(', ')}`).join(' | ');
          parts.push(`Hierarquia: ${hierarchy}`);
        }
        if (s.keyInsights) parts.push(`Insights: ${s.keyInsights.join('; ')}`);
        return parts.join('\n');
      }).join('\n\n');

    case 'draft_generation':
    case 'pre_reading':
    default:
      return summaries.map((s, i) => {
        const parts = [`=== RESUMO DO DOCUMENTO ${i + 1}: ${s.documentName || 'Documento'} (${s.documentType || 'apoio'}) ===`];
        if (s.keyConcepts) parts.push(`Conceitos-chave: ${s.keyConcepts.join('; ')}`);
        if (s.legalRefs) parts.push(`Referências legais: ${s.legalRefs.join('; ')}`);
        if (s.definitions) parts.push(`Definições: ${s.definitions.map(d => `${d.term}: ${d.definition}`).join('; ')}`);
        if (s.examPatterns) parts.push(`Padrões de prova: ${s.examPatterns.join('; ')}`);
        if (s.syllabus) parts.push(`Conteúdo programático: ${s.syllabus.join('; ')}`);
        if (s.keyInsights) parts.push(`Insights: ${s.keyInsights.join('; ')}`);
        return parts.join('\n');
      }).join('\n\n');
  }
}

module.exports = {
  summarizeDocument,
  getOrCreateSummary,
  invalidateSummary,
  getDocumentContext,
};
