/**
 * StepD — Revisão Automática do Rascunho.
 * Detecta inconsistências, possíveis alucinações e conceitos sem suporte documental.
 */
const { logStepStart, logStepComplete, logStepError } = require('../../observability/logger');

const STEP_NAME = 'D_Revision';

/**
 * @param {object} ctx - Contexto do pipeline (inclui stepC output)
 * @param {object} llm - Instância de LLMProvider
 * @returns {Promise<{issues: string[], revisedDraft: string, hadIssues: boolean}>}
 */
async function run(ctx, llm) {
  const { pipelineId, discipline, topic, ragSources, stepC } = ctx;
  logStepStart({ pipelineId, step: STEP_NAME });
  const t0 = Date.now();

  const { draft } = stepC;

  // Referências disponíveis para verificação
  const knownFacts = (ragSources || [])
    .slice(0, 4)
    .map(r => `• ${r.title}: ${r.snippet}`)
    .join('\n');

  const prompt = `Você é um revisor especializado em concursos públicos brasileiros.
Revise criticamente o texto de pré-leitura abaixo sobre "${topic}" (${discipline}).

=== TEXTO PARA REVISAR ===
${draft}

${knownFacts ? `=== REFERÊNCIAS VERIFICÁVEIS ===\n${knownFacts}\n` : ''}

Identifique e corrija:
1. **Inconsistências**: afirmações contraditórias entre si ou com as referências
2. **Possíveis alucinações**: afirmações específicas (números, datas, artigos) que não estão nas referências
3. **Conceitos sem suporte**: afirmações apresentadas como fato sem embasamento contextual

Retorne JSON com:
{
  "issues": ["problema encontrado 1", "problema 2"],
  "revisedDraft": "texto completo corrigido, mantendo todas as flags [IA][Documento][Busca] e a legenda inicial",
  "hadIssues": true
}

Se o texto estiver correto e sem problemas, retorne hadIssues: false e revisedDraft igual ao original.
Responda APENAS com o JSON.`;

  try {
    const result = await llm.generateJSON(prompt, { purpose: STEP_NAME });
    const hadIssues = result.hadIssues === true && (result.issues || []).length > 0;
    logStepComplete({ pipelineId, step: STEP_NAME, durationMs: Date.now() - t0, meta: { hadIssues, issuesCount: (result.issues || []).length } });
    return {
      issues: result.issues || [],
      revisedDraft: result.revisedDraft || draft,
      hadIssues,
    };
  } catch (err) {
    logStepError({ pipelineId, step: STEP_NAME, error: err });
    // Revisão falhou — retornar o rascunho original sem bloquear o pipeline
    return { issues: [], revisedDraft: draft, hadIssues: false };
  }
}

module.exports = { run };
