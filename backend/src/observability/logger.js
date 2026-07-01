/**
 * Logger estruturado para observabilidade do pipeline de geração de conteúdo.
 * Emite JSON para facilitar integração futura com OpenTelemetry / Sentry.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

function emit(level, event, metadata = {}) {
  if (LOG_LEVELS[level] < MIN_LEVEL) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...metadata,
  };
  const out = level === 'error' ? console.error : console.log;
  out(JSON.stringify(entry));
}

// ── Pipeline lifecycle ──────────────────────────────────────────────────────

function logPipelineStart({ pipelineId, discipline, topic, model }) {
  emit('info', 'pipeline.start', { pipelineId, discipline, topic, model });
}

function logStepStart({ pipelineId, step }) {
  emit('debug', 'pipeline.step.start', { pipelineId, step });
}

function logStepComplete({ pipelineId, step, durationMs, meta = {} }) {
  emit('info', 'pipeline.step.complete', { pipelineId, step, durationMs, ...meta });
}

function logStepError({ pipelineId, step, error }) {
  emit('error', 'pipeline.step.error', {
    pipelineId,
    step,
    error: error?.message || String(error),
    stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
  });
}

function logPipelineComplete({ pipelineId, totalDurationMs, qualityScore, sourcesCount, hadRevisionIssues }) {
  emit('info', 'pipeline.complete', {
    pipelineId,
    totalDurationMs,
    qualityScore,
    sourcesCount,
    hadRevisionIssues,
  });
}

// ── Search / RAG ────────────────────────────────────────────────────────────

function logSearchComplete({ provider, query, resultsCount, durationMs }) {
  emit('info', 'search.complete', { provider, query, resultsCount, durationMs });
}

function logSearchError({ provider, query, error }) {
  emit('warn', 'search.error', { provider, query, error: error?.message || String(error) });
}

function logExtractionComplete({ url, chars, durationMs }) {
  emit('debug', 'extraction.complete', { url, chars, durationMs });
}

// ── LLM calls ───────────────────────────────────────────────────────────────

function logLLMCall({ model, purpose, promptTokensEstimate, durationMs }) {
  emit('info', 'llm.call', { model, purpose, promptTokensEstimate, durationMs });
}

function logLLMError({ model, purpose, error }) {
  emit('error', 'llm.error', { model, purpose, error: error?.message || String(error) });
}

module.exports = {
  logPipelineStart,
  logStepStart,
  logStepComplete,
  logStepError,
  logPipelineComplete,
  logSearchComplete,
  logSearchError,
  logExtractionComplete,
  logLLMCall,
  logLLMError,
};
