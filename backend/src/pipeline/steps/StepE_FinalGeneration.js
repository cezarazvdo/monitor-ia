/**
 * StepE — Geração da Versão Final.
 * Recebe o rascunho revisado e gera a versão final polida com o mapa Mermaid.
 */
const { logStepStart, logStepComplete, logStepError } = require('../../observability/logger');

const STEP_NAME = 'E_FinalGeneration';

/**
 * @param {object} ctx - Contexto do pipeline (inclui stepD output)
 * @param {object} llm - Instância de LLMProvider
 * @returns {Promise<{finalContent: string}>}
 */
async function run(ctx, llm) {
  const { pipelineId, topic, discipline, stepD, stepA } = ctx;
  logStepStart({ pipelineId, step: STEP_NAME });
  const t0 = Date.now();

  const { revisedDraft, issues, hadIssues } = stepD;
  const dominantTopics = stepA?.dominantTopics || [topic];

  const issuesNote = hadIssues && issues.length > 0
    ? `\nProblemas corrigidos na revisão:\n${issues.map(i => `- ${i}`).join('\n')}\n`
    : '';

  const prompt = `Você é um editor especializado em material didático para concursos públicos.
Transforme o rascunho revisado abaixo na VERSÃO FINAL do texto de pré-leitura sobre "${topic}" (${discipline}).
${issuesNote}
=== RASCUNHO REVISADO ===
${revisedDraft}

Instruções para a versão final:
1. Mantenha TODAS as flags [IA], [Documento], [Busca] e a legenda inicial
2. Melhore a fluidez e clareza do texto sem alterar o conteúdo
3. Certifique-se de que os 3 pontos-chave do resumo final cobrem: ${dominantTopics.slice(0, 3).join(', ')}
4. Ao final do texto, OBRIGATÓRIO: adicione um mapa mental em Mermaid (graph TD ou LR):
   - Use apenas IDs alfanuméricos e hifens (ex: no1, lgpd-art5)
   - Coloque textos com espaços entre aspas: no1["Texto do Nó"]
   - Máximo 12 nós para clareza visual
   - Não use caracteres especiais (acentos, &, <, >) nos IDs dos nós

Formato do bloco Mermaid:
\`\`\`mermaid
graph TD
    A["${topic}"] --> B["..."]
\`\`\`

Retorne apenas o texto final completo (markdown), sem comentários extras.`;

  try {
    const finalContent = await llm.generate(prompt, { purpose: STEP_NAME });
    logStepComplete({ pipelineId, step: STEP_NAME, durationMs: Date.now() - t0, meta: { finalLength: finalContent.length } });
    return { finalContent };
  } catch (err) {
    logStepError({ pipelineId, step: STEP_NAME, error: err });
    // Fallback: retornar o rascunho revisado sem polimento final
    return { finalContent: revisedDraft };
  }
}

module.exports = { run };
