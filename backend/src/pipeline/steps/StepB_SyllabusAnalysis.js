/**
 * StepB — Análise do Conteúdo Programático (Edital).
 * Identifica cobertura, lacunas e priorização dos tópicos do edital.
 */
const { logStepStart, logStepComplete, logStepError } = require('../../observability/logger');

const STEP_NAME = 'B_SyllabusAnalysis';

/**
 * @param {object} ctx - Contexto do pipeline
 * @param {object} llm - Instância de LLMProvider
 * @returns {Promise<{coverage: string[], gaps: string[], priorities: string[]}>}
 */
async function run(ctx, llm) {
  const { pipelineId, topic, discipline, documents, documentContext } = ctx;
  logStepStart({ pipelineId, step: STEP_NAME });
  const t0 = Date.now();

  // Fonte primária: resumo compactado do edital (documentContext.syllabusAnalysis)
  const syllabusFromContext = documentContext?.syllabusAnalysis || '';

  // Fonte secundária: text_content direto de edital/apoio (compatibilidade legada)
  const relevantDocs = (documents || []).filter(d =>
    ['edital', 'apoio'].includes(d.type) && d.text_content
  ).slice(0, 2);

  const docContext = relevantDocs
    .map(d => `[${d.original_name || d.type}]:\n${d.text_content.slice(0, 800)}`)
    .join('\n\n---\n\n');

  // Se não há nenhum contexto de edital → defaults
  if (!syllabusFromContext && relevantDocs.length === 0) {
    const result = {
      coverage: [topic],
      gaps: [],
      priorities: [`Estudar os fundamentos de ${topic}`, `Focar em legislação e artigos específicos de ${discipline}`],
    };
    logStepComplete({ pipelineId, step: STEP_NAME, durationMs: Date.now() - t0, meta: { source: 'default' } });
    return result;
  }

  const prompt = `Analise o conteúdo programático/edital abaixo para a disciplina "${discipline}" e tópico "${topic}".

${syllabusFromContext ? `== CONTEÚDO PROGRAMÁTICO DO EDITAL (FONTE PRIMÁRIA) ==\n${syllabusFromContext}\n` : ''}
${docContext ? `== TRECHOS DO EDITAL ==\n${docContext}\n` : ''}

REGRA OBRIGATÓRIA: O texto de estudo que será gerado DEVE cobrir apenas o que está previsto no edital acima.
- Identifique o que está COBERTO no edital relacionado a "${topic}".
- Identifique o que pode estar FALTANDO ou pouco detalhado (lacunas).
- Defina os itens de MAIOR PRIORIDADE para o candidato estudar, baseando-se no edital.

Retorne JSON com:
{
  "coverage": ["item coberto 1 pelo edital", "item coberto 2"],
  "gaps": ["lacuna identificada 1 no edital", "lacuna 2"],
  "priorities": ["prioridade 1 — mais importante conforme edital", "prioridade 2"]
}

Responda APENAS com o JSON.`;

  try {
    const result = await llm.generateJSON(prompt, { purpose: STEP_NAME });
    logStepComplete({ pipelineId, step: STEP_NAME, durationMs: Date.now() - t0, meta: { coverageCount: result.coverage?.length, gapsCount: result.gaps?.length, source: 'documentContext' } });
    return result;
  } catch (err) {
    logStepError({ pipelineId, step: STEP_NAME, error: err });
    return {
      coverage: [topic],
      gaps: [],
      priorities: [`Fundamentos de ${topic}`],
    };
  }
}

module.exports = { run };
