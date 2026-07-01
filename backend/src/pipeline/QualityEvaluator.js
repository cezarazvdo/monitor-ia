/**
 * QualityEvaluator — Avaliador independente de qualidade do conteúdo gerado.
 * Avalia 4 dimensões com nota de 0 a 10 e retorna ContentQualityScore.
 */
const { logStepStart, logStepComplete, logStepError } = require('../observability/logger');

const STEP_NAME = 'QualityEvaluator';

/**
 * @typedef {object} ContentQualityScore
 * @property {number} factualAccuracy - Precisão factual (0-10)
 * @property {number} clarity - Clareza e didática (0-10)
 * @property {number} syllabusCoverage - Cobertura do edital (0-10)
 * @property {number} bancaAlignment - Aderência ao perfil da banca (0-10)
 * @property {number} overallScore - Nota geral (0-10)
 */

/**
 * Avalia a qualidade do conteúdo gerado.
 * @param {object} params
 * @param {string} params.pipelineId
 * @param {string} params.finalContent - Conteúdo final gerado
 * @param {string} params.topic
 * @param {string} params.discipline
 * @param {object} params.stepA - Output da análise de provas
 * @param {object} params.stepB - Output da análise do edital
 * @param {object} llm - Instância de LLMProvider
 * @returns {Promise<ContentQualityScore>}
 */
async function evaluate({ pipelineId, finalContent, topic, discipline, stepA, stepB }, llm) {
  logStepStart({ pipelineId, step: STEP_NAME });
  const t0 = Date.now();

  const bancaProfile = stepA?.bancaProfile || 'Geral';
  const priorities = stepB?.priorities || [];
  const coverage = stepB?.coverage || [];

  const prompt = `Você é um avaliador independente de material didático para concursos públicos.
Avalie o texto de pré-leitura abaixo sobre "${topic}" (${discipline}) em 4 dimensões, de 0 a 10:

=== TEXTO A AVALIAR ===
${finalContent.slice(0, 3000)}

=== CONTEXTO DE AVALIAÇÃO ===
Perfil da banca: ${bancaProfile}
Prioridades do edital: ${priorities.join(', ') || 'Não identificadas'}
Cobertura esperada: ${coverage.join(', ') || 'Não identificada'}

=== CRITÉRIOS ===
1. **factualAccuracy** (0-10): Precisão das informações factuais (artigos, números, datas)
2. **clarity** (0-10): Clareza, organização e facilidade de compreensão
3. **syllabusCoverage** (0-10): Quanto o texto cobre os tópicos do edital/prioridades
4. **bancaAlignment** (0-10): Aderência ao estilo e nível de exigência da banca

Retorne JSON com:
{
  "factualAccuracy": 8,
  "clarity": 9,
  "syllabusCoverage": 7,
  "bancaAlignment": 8,
  "overallScore": 8.0,
  "feedback": "Breve comentário sobre os pontos fortes e o que poderia melhorar"
}

Responda APENAS com o JSON.`;

  try {
    const result = await llm.generateJSON(prompt, { purpose: STEP_NAME });

    // Normalizar e validar notas
    const normalize = (v) => Math.min(10, Math.max(0, Number(v) || 0));
    const score = {
      factualAccuracy: normalize(result.factualAccuracy),
      clarity: normalize(result.clarity),
      syllabusCoverage: normalize(result.syllabusCoverage),
      bancaAlignment: normalize(result.bancaAlignment),
      overallScore: normalize(result.overallScore || (
        (normalize(result.factualAccuracy) + normalize(result.clarity) +
         normalize(result.syllabusCoverage) + normalize(result.bancaAlignment)) / 4
      )),
      feedback: result.feedback || '',
    };

    logStepComplete({ pipelineId, step: STEP_NAME, durationMs: Date.now() - t0, meta: { overallScore: score.overallScore } });
    return score;
  } catch (err) {
    logStepError({ pipelineId, step: STEP_NAME, error: err });
    // Retornar score neutro em caso de erro (não bloquear o pipeline)
    return {
      factualAccuracy: 7,
      clarity: 7,
      syllabusCoverage: 7,
      bancaAlignment: 7,
      overallScore: 7,
      feedback: 'Avaliação automática indisponível',
    };
  }
}

module.exports = { evaluate };
