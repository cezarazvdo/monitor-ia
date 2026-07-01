/**
 * StepC — Geração do Rascunho Preliminar.
 * Gera o texto de pré-leitura com base nas análises das etapas A e B e no contexto RAG.
 */
const { logStepStart, logStepComplete, logStepError } = require('../../observability/logger');

const STEP_NAME = 'C_DraftGeneration';

/**
 * @param {object} ctx - Contexto do pipeline (inclui stepA e stepB outputs)
 * @param {object} llm - Instância de LLMProvider
 * @returns {Promise<{draft: string, tokensEstimate: number}>}
 */
async function run(ctx, llm) {
  const { pipelineId, discipline, topic, subtopic, ragSources, stepA, stepB, documents, documentContext, banca } = ctx;
  logStepStart({ pipelineId, step: STEP_NAME });
  const t0 = Date.now();

  // Fonte primária: resumos compactados de todos os documentos (economia de tokens)
  const draftSupportContext = documentContext?.draftSupport || '';

  // Fonte secundária: text_content direto (compatibilidade legada, raramente preenchido)
  const docContextLegacy = (documents || [])
    .filter(d => d.text_content)
    .slice(0, 2)
    .map(d => `[${d.original_name}]: ${d.text_content.slice(0, 600)}`)
    .filter(Boolean)
    .join('\n\n');

  // Contexto final de documentos: priorizar resumos compactados
  const docContext = draftSupportContext || docContextLegacy;

  // Construir contexto RAG (busca web)
  const ragContext = (ragSources || [])
    .slice(0, 5)
    .map(r => `Título: ${r.title}\nTrecho: ${r.snippet}${r.content ? `\nConteúdo: ${r.content.slice(0, 400)}` : ''}\nFonte: ${r.url}`)
    .join('\n\n');

  // Construir insights das etapas anteriores
  const examInsights = stepA ? `
Perfil da banca: ${stepA.bancaProfile}
Tópicos mais cobrados nas provas: ${(stepA.dominantTopics || []).join(', ')}
Padrões identificados nas provas: ${(stepA.patterns || []).join('; ')}
Profundidade esperada: ${stepA.depthLevel === 3 ? 'Aprofundado' : stepA.depthLevel === 1 ? 'Básico' : 'Intermediário'}
`.trim() : '';

  const syllabusInsights = stepB ? `
Cobertura do edital: ${(stepB.coverage || []).join(', ')}
Lacunas no edital: ${(stepB.gaps || []).join(', ')}
Prioridades conforme edital: ${(stepB.priorities || []).join('; ')}
`.trim() : '';

  const prompt = `Gere um RASCUNHO de texto de pré-leitura (~600 palavras, máximo 5 minutos de leitura) sobre:
Disciplina: ${discipline}
Tópico: ${topic}
${subtopic ? `Subtópico: ${subtopic}` : ''}
Banca Alvo: ${banca || 'Não especificada'}

${examInsights ? `== ANÁLISE DAS PROVAS ANEXADAS ==\n${examInsights}\n` : ''}
${syllabusInsights ? `== ANÁLISE DO EDITAL ANEXADO ==\n${syllabusInsights}\n` : ''}
${docContext ? `== CONTEXTO DOS DOCUMENTOS (EDITAL + PROVAS + MATERIAL) ==\n${docContext}\n` : ''}
${ragContext ? `== RESULTADOS DA BUSCA WEB ==\n${ragContext}\n` : ''}

REGRAS OBRIGATÓRIAS:
1. O conteúdo DEVE ser derivado do conteúdo programático do edital anexado.
   - Não gere tópicos fora do escopo definido no edital.
   - Cubra os itens do edital identificados em "Cobertura do edital" acima.
   - Preencha as lacunas identificadas em "Lacunas no edital" com atenção especial.
2. O foco e a profundidade DEVEM refletir os padrões das provas anteriores anexadas.
   - Tópicos mais cobrados nas provas recebem mais espaço e atenção no texto.
   - O estilo deve espelhar o padrão da banca "${banca || 'Geral'}" (literalidade de leis se FCC/Vunesp; teoria aplicada se CESPE; casos práticos se FGV).
3. Use ## para subtítulos e seções claras.
4. Inclua exemplos práticos quando relevante.
5. Para legislação: cite artigos e parágrafos específicos.
6. Termine com "### Resumo — 3 Pontos-Chave" com 3 itens numerados.
7. No início de cada parágrafo ou seção, adicione a flag de origem em negrito:
   - **[IA]** para conceitos do seu conhecimento geral
   - **[Documento]** para informações vindas dos documentos enviados
   - **[Busca]** para dados vindos da busca web
8. Inicie o texto com: ***Legenda: [IA] Inteligência Artificial | [Documento] Documentos Enviados | [Busca] Busca Web***

Este é um RASCUNHO que será revisado na próxima etapa. Priorize cobertura e correção.`;

  try {
    const draft = await llm.generate(prompt, { purpose: STEP_NAME });
    const tokensEstimate = Math.ceil(prompt.length / 4) + Math.ceil(draft.length / 4);
    logStepComplete({ pipelineId, step: STEP_NAME, durationMs: Date.now() - t0, meta: { draftLength: draft.length, tokensEstimate, hasDocContext: !!docContext } });
    return { draft, tokensEstimate };
  } catch (err) {
    logStepError({ pipelineId, step: STEP_NAME, error: err });
    throw err; // Este step é crítico — propaga o erro
  }
}

module.exports = { run };
