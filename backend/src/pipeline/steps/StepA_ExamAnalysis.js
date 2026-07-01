/**
 * StepA — Análise de Provas Anteriores.
 * Extrai assuntos recorrentes, frequência, perfil da banca e nível de profundidade.
 */
const { logStepStart, logStepComplete, logStepError } = require('../../observability/logger');

const STEP_NAME = 'A_ExamAnalysis';

/**
 * @param {object} ctx - Contexto do pipeline
 * @param {object} llm - Instância de LLMProvider
 * @returns {Promise<{dominantTopics: string[], bancaProfile: string, depthLevel: number, patterns: string[]}>}
 */
async function run(ctx, llm) {
  const { pipelineId, discipline, topic, examPatterns, documents, documentContext, banca } = ctx;
  logStepStart({ pipelineId, step: STEP_NAME });
  const t0 = Date.now();

  const defaultBanca = banca || 'Geral (CESPE/Cebraspe)';

  // Fonte primária: resumos compactados das provas (documentContext.examAnalysis)
  const examContextFromSummaries = documentContext?.examAnalysis || '';

  // Fonte secundária: padrões extraídos do banco
  const examContextFromPatterns = examPatterns?.length > 0
    ? `Padrões detectados automaticamente: ${examPatterns.join('; ')}`
    : '';

  // Fonte terciária: text_content direto (compatibilidade legada, raramente preenchido)
  const docsContext = (documents || [])
    .filter(d => ['prova', 'gabarito'].includes(d.type) && d.text_content)
    .slice(0, 2)
    .map(d => `[${d.original_name}]: ${d.text_content.slice(0, 1000)}`)
    .join('\n\n---\n\n');

  // Se não há nenhum contexto de prova disponível → defaults inteligentes
  if (!examContextFromSummaries && !examContextFromPatterns && !docsContext) {
    const result = {
      dominantTopics: [topic],
      bancaProfile: defaultBanca,
      depthLevel: 2,
      patterns: ['Questões objetivas de múltipla escolha', `Foco no estilo e padrão da banca ${defaultBanca}`],
    };
    logStepComplete({ pipelineId, step: STEP_NAME, durationMs: Date.now() - t0, meta: { source: 'default' } });
    return result;
  }

  const prompt = `Analise as informações de provas de concurso abaixo para a disciplina "${discipline}" e tópico "${topic}".
Banca do concurso: ${defaultBanca}

${examContextFromSummaries ? `== RESUMO DAS PROVAS ANEXADAS (FONTE PRIMÁRIA) ==\n${examContextFromSummaries}\n` : ''}
${examContextFromPatterns ? `== PADRÕES DETECTADOS ==\n${examContextFromPatterns}\n` : ''}
${docsContext ? `== TRECHOS DAS PROVAS ==\n${docsContext}\n` : ''}

REGRA OBRIGATÓRIA: O conteúdo que será gerado DEVE ser baseado exclusivamente nas provas e padrões acima.
- Identifique os tópicos mais cobrados em "${topic}" dentro de "${discipline}".
- O foco e a profundidade do conteúdo devem espelhar exatamente o que as provas cobram.
- Adapte o estilo da análise ao perfil da banca "${defaultBanca}".

Retorne JSON com:
{
  "dominantTopics": ["tópico mais cobrado 1", "tópico 2"],
  "bancaProfile": "Nome da banca e estilo (ex: CESPE - assertivas verdadeiro/falso)",
  "depthLevel": 2,
  "patterns": ["padrão observado 1 nas provas", "padrão 2"]
}

Onde depthLevel é: 1=superficial, 2=intermediário, 3=aprofundado.
Responda APENAS com o JSON.`;

  try {
    const result = await llm.generateJSON(prompt, { purpose: STEP_NAME });
    logStepComplete({ pipelineId, step: STEP_NAME, durationMs: Date.now() - t0, meta: { dominantTopicsCount: result.dominantTopics?.length, source: 'documentContext' } });
    return result;
  } catch (err) {
    logStepError({ pipelineId, step: STEP_NAME, error: err });
    // Fallback gracioso
    return {
      dominantTopics: [topic],
      bancaProfile: defaultBanca,
      depthLevel: 2,
      patterns: examPatterns || [],
    };
  }
}

module.exports = { run };
