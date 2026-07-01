/**
 * PreReadingPipeline — Orquestrador do pipeline de geração de pré-leitura.
 * Executa os steps A → B → C → D → E e o avaliador de qualidade.
 *
 * Fluxo:
 *   A: Análise de provas
 *   B: Análise do edital
 *   RAG: Enriquecimento de contexto via busca
 *   C: Geração do rascunho
 *   D: Revisão automática
 *   E: Versão final polida
 *   Q: Avaliação de qualidade (independente)
 */
const { v4: uuidv4 } = require('uuid');
const GeminiProvider = require('../services/providers/llm/GeminiProvider');
const { ragEnrichContext } = require('../services/search.service');
const StepA = require('./steps/StepA_ExamAnalysis');
const StepB = require('./steps/StepB_SyllabusAnalysis');
const StepC = require('./steps/StepC_DraftGeneration');
const StepD = require('./steps/StepD_Revision');
const StepE = require('./steps/StepE_FinalGeneration');
const QualityEvaluator = require('./QualityEvaluator');
const {
  logPipelineStart,
  logPipelineComplete,
} = require('../observability/logger');

/**
 * Executa o pipeline completo de geração de pré-leitura.
 *
 * @param {object} params
 * @param {string} params.discipline
 * @param {string} params.topic
 * @param {string} [params.subtopic]
 * @param {string[]} [params.examPatterns]
 * @param {object[]} [params.documents]
 * @returns {Promise<{
 *   content: string,
 *   pipelineId: string,
 *   qualityScore: object,
 *   ragSources: object[],
 *   stepsCompleted: string[],
 *   hadRevisionIssues: boolean,
 *   totalDurationMs: number,
 * }>}
 */
async function run({ discipline, topic, subtopic, examPatterns, documents, documentContext, banca }) {
  const pipelineId = uuidv4();
  const llm = new GeminiProvider();
  const t0 = Date.now();
  const stepsCompleted = [];

  logPipelineStart({ pipelineId, discipline, topic, model: llm.modelId });

  if (!llm.isConfigured()) {
    throw new Error('LLM não configurado — GEMINI_API_KEY ausente');
  }

  // Contexto compartilhado entre steps
  const ctx = {
    pipelineId,
    discipline,
    topic,
    subtopic,
    examPatterns,
    documents,
    documentContext: documentContext || { examAnalysis: '', syllabusAnalysis: '', draftSupport: '' },
    banca,
    ragSources: [],
    stepA: null,
    stepB: null,
    stepC: null,
    stepD: null,
    stepE: null,
  };

  // ── Step A: Análise de Provas ─────────────────────────────────────────────
  ctx.stepA = await StepA.run(ctx, llm);
  stepsCompleted.push('A_ExamAnalysis');

  // ── Step B: Análise do Edital ─────────────────────────────────────────────
  ctx.stepB = await StepB.run(ctx, llm);
  stepsCompleted.push('B_SyllabusAnalysis');

  // ── RAG: Enriquecimento de Contexto ───────────────────────────────────────
  ctx.ragSources = await ragEnrichContext({
    topic,
    subtopic,
    discipline,
    maxResults: 5,
    extractContent: false, // Desativado por default para reduzir latência
  }).catch(() => []);
  stepsCompleted.push('RAG_Enrichment');

  // ── Step C: Geração do Rascunho ───────────────────────────────────────────
  ctx.stepC = await StepC.run(ctx, llm);
  stepsCompleted.push('C_DraftGeneration');

  // ── Step D: Revisão ───────────────────────────────────────────────────────
  ctx.stepD = await StepD.run(ctx, llm);
  stepsCompleted.push('D_Revision');

  // ── Step E: Versão Final ──────────────────────────────────────────────────
  ctx.stepE = await StepE.run(ctx, llm);
  stepsCompleted.push('E_FinalGeneration');

  // ── Avaliação de Qualidade ────────────────────────────────────────────────
  const qualityScore = await QualityEvaluator.evaluate({
    pipelineId,
    finalContent: ctx.stepE.finalContent,
    topic,
    discipline,
    stepA: ctx.stepA,
    stepB: ctx.stepB,
  }, llm);
  stepsCompleted.push('QualityEvaluation');

  const totalDurationMs = Date.now() - t0;
  const hadRevisionIssues = ctx.stepD?.hadIssues || false;

  logPipelineComplete({
    pipelineId,
    totalDurationMs,
    qualityScore: qualityScore.overallScore,
    sourcesCount: ctx.ragSources.length,
    hadRevisionIssues,
  });

  return {
    content: ctx.stepE.finalContent,
    pipelineId,
    qualityScore,
    ragSources: ctx.ragSources,
    stepsCompleted,
    hadRevisionIssues,
    totalDurationMs,
  };
}

module.exports = { run };
