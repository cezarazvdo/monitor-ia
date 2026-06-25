const { GoogleGenerativeAI } = require('@google/generative-ai');
const { searchSerper } = require('./search.service');

let client = null;

function getClient() {
  if (!client && process.env.GEMINI_API_KEY) {
    client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return client;
}

const SYSTEM_PROMPT = `Você é um assistente especializado em preparação para concursos públicos brasileiros.
Seu papel é gerar conteúdo didático de alta qualidade, objetivo e focado.
Sempre responda em português do Brasil.
Para questões, siga o padrão das bancas de concurso (CESPE, FGV, Vunesp, etc.).
Priorize Legislação (LGPD, ISO 27001/27002, Marco Civil), Lógica e Matemática.`;

// Helper to get model
function getModel(options = {}) {
  const gemini = getClient();
  if (!gemini) return null;
  return gemini.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    ...options,
  });
}

// Gerar pré-leitura (conteúdo teórico breve)
async function generatePreReading({ discipline, topic, subtopic, examPatterns, documents }) {
  const model = getModel();

  if (!model) {
    return generateMockPreReading(discipline, topic);
  }

  // Buscar na web via Serper para enriquecer o contexto
  const searchResults = await searchSerper(`${topic} ${subtopic || ''} concurso público`, 3).catch(() => []);

  const contextParts = [];
  if (examPatterns && examPatterns.length > 0) {
    contextParts.push(`Padrões identificados nas provas: ${examPatterns.join('; ')}`);
  }
  if (documents && documents.length > 0) {
    const docContext = documents.slice(0, 2).map(d => d.text_content?.slice(0, 1000)).filter(Boolean).join('\n\n');
    if (docContext) contextParts.push(`Contexto dos documentos:\n${docContext}`);
  }
  if (searchResults && searchResults.length > 0) {
    const searchContext = searchResults.map(r => `Título: ${r.title}\nTrecho: ${r.snippet}\nLink: ${r.url}`).join('\n\n');
    if (searchContext) contextParts.push(`Resultados da busca web (Serper):\n${searchContext}`);
  }

  const prompt = `Gere um texto de pré-leitura (máximo 5 minutos de leitura, ~600 palavras) sobre:
Disciplina: ${discipline}
Tópico: ${topic}
${subtopic ? `Subtópico: ${subtopic}` : ''}
${contextParts.length > 0 ? '\n' + contextParts.join('\n') : ''}

O texto deve:
1. Ser objetivo e direto ao ponto
2. Destacar os pontos mais cobrados em provas
3. Incluir exemplos práticos quando relevante
4. Usar formatação com seções claras (use ## para subtítulos)
5. Terminar com um resumo de 3 pontos-chave
6. Para legislação: cite artigos e parágrafos específicos
7. OBRIGATÓRIO (IDENTIFICAÇÃO DE FONTES): No início de cada parágrafo, seção ou ponto chave do texto teórico, adicione uma das seguintes flags/tags em negrito de acordo com a origem real daquela informação:
   - **[IA]**: para conceitos baseados no seu próprio conhecimento geral.
   - **[Documento]**: para fatos tirados diretamente da seção "Contexto dos documentos".
   - **[Busca]**: para dados ou detalhes vindos da seção "Resultados da busca web (Serper)".
   Você DEVE iniciar o conteúdo com uma linha destacada em itálico e negrito explicando a legenda das flags (ex: "*Origem das informações: [IA] Inteligência Artificial | [Documento] Documentos Enviados | [Busca] Busca Web*").
8. OBRIGATÓRIO (MAPA MENTAL): Adicione no final do conteúdo um mapa mental resumido usando a sintaxe Mermaid (bloco de código com a linguagem 'mermaid', usando diagramas do tipo flowchart, ex: 'graph TD' ou 'graph LR') para esquematizar de forma visual e intuitiva o assunto abordado e as relações com os pontos mais cobrados nas provas. Use caixas de texto com rótulos curtos e conexões diretas. Evite caracteres especiais incompatíveis com a sintaxe do Mermaid nos IDs dos nós (use letras e números e adicione o texto entre aspas se necessário, ex: no1["Texto do Nó"]).`;

  try {
    const result = await model.generateContent(prompt);
    return { content: result.response.text() };
  } catch (error) {
    console.warn('[GEMINI API WARNING] Fallback to mock pre-reading:', error.message);
    return { content: generateMockPreReading(discipline, topic), apiWarning: error.message };
  }
}

// Gerar questões estilo concurso
async function generateQuestions({ discipline, topic, content, count = 10, examPatterns, difficulty = 2 }) {
  const model = getModel();

  if (!model) {
    return generateMockQuestions(discipline, topic, count);
  }

  const prompt = `Gere exatamente ${count} questões objetivas estilo concurso sobre:
Disciplina: ${discipline}
Tópico: ${topic}
Dificuldade: ${difficulty}/3

Baseie as questões no seguinte conteúdo:
${content?.slice(0, 2000) || topic}

${examPatterns?.length > 0 ? `Padrões das provas anteriores: ${examPatterns.join('; ')}` : ''}

REGRAS OBRIGATÓRIAS:
- Cada questão tem exatamente 4 alternativas (A, B, C, D)
- Uma única alternativa correta
- Na propriedade "explanation", faça um gabarito comentado detalhado. Você DEVE explicar por que a resposta correta está certa E também detalhar o que está incorreto em CADA UMA das alternativas erradas (discordâncias com o texto/lei de referência).
- Misture questões conceituais e aplicadas
- Para legislação: inclua questões sobre artigos específicos

Responda APENAS com JSON válido no formato:
{
  "questions": [
    {
      "stem": "Enunciado da questão...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct": "A",
      "explanation": "Explicação detalhada...",
      "difficulty": 2
    }
  ]
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });
    const text = result.response.text();
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '');
    const parsed = JSON.parse(cleanJson).questions;
    return { questions: parsed };
  } catch (error) {
    console.warn('[GEMINI API WARNING] Fallback to mock questions:', error.message);
    return { questions: generateMockQuestions(discipline, topic, count), apiWarning: error.message };
  }
}

// Gerar explicação detalhada para erro
async function generateErrorExplanation({ question, userAnswer, correctAnswer, discipline }) {
  const model = getModel();

  if (!model) {
    return `A resposta correta é ${correctAnswer}. ${question.explanation || 'Revise o conteúdo sobre ' + question.topic + '.'}`;
  }

  const prompt = `O estudante errou a seguinte questão de ${discipline}:

Enunciado: ${question.stem}
Opções: ${JSON.stringify(question.options)}
Resposta do estudante: ${userAnswer}
Resposta correta: ${correctAnswer}

Forneça:
1. Por que a resposta correta está certa (explicação clara e direta)
2. Por que a opção escolhida está errada
3. Dica mnemônica ou regra fácil de lembrar
4. Referência ao conteúdo/lei/artigo relevante`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.warn('[GEMINI API WARNING] Fallback to mock error explanation:', error.message);
    return `A resposta correta é ${correctAnswer}. ${question.explanation || 'Revise o conteúdo sobre ' + question.topic + '.'}`;
  }
}

// Analisar provas enviadas
async function analyzeExamPapers({ examTexts }) {
  const model = getModel();

  if (!model) {
    return generateMockAnalysis();
  }

  const combined = examTexts.map((t, i) => `=== PROVA ${i + 1} ===\n${t.slice(0, 3000)}`).join('\n\n');

  const prompt = `Analise as seguintes provas de concurso e extraia:

${combined}

Retorne JSON com:
{
  "patterns": ["padrão 1", "padrão 2", ...],
  "topTopics": [
    {"discipline": "...", "topic": "...", "frequency": 5, "difficulty": 2}
  ],
  "commonMistakes": ["erro comum 1", ...],
  "questionTypes": ["tipo 1", "tipo 2", ...],
  "recommendations": ["recomendação 1", ...]
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (error) {
    console.warn('[GEMINI API WARNING] Fallback to mock exam analysis:', error.message);
    return generateMockAnalysis();
  }
}

// === MOCK FUNCTIONS (sem API key) ===

function generateMockPreReading(discipline, topic) {
  return `***Legenda de Fontes: [IA] Inteligência Artificial | [Documento] Documentos Enviados | [Busca] Busca Web***

## **[IA]** ${topic} — Resumo para Estudo

### **[IA]** Conceitos Fundamentais

Este é um conteúdo de demonstração gerado sem API key. Configure sua chave Gemini em **Configurações** para conteúdo personalizado.

### Pontos Principais

**1. [IA] Base teórica**
O estudo de ${topic} no contexto de ${discipline} exige compreensão dos fundamentos estabelecidos pela legislação e normas técnicas brasileiras.

**2. [Documento] Aplicação prática**
As questões de concurso frequentemente testam a capacidade de aplicar conceitos teóricos em situações práticas extraídas das provas e editais anexados.

**3. [Busca] Legislação relevante**
De acordo com buscas em portais legislativos confiáveis:
- Lei nº 13.709/2018 (LGPD)
- ISO/IEC 27001 e 27002
- Marco Civil da Internet (Lei 12.965/2014)

### Resumo — 3 Pontos-Chave

1. 📌 **[IA] Fundamentos legais** são sempre cobrados — memorize artigos e incisos específicos.
2. 📌 **[Documento] Exceções e casos especiais** baseados nos editais costumam ser o foco das questões.
3. 📌 **[Busca] Terminologia técnica** oficial deve ser dominada com precisão para evitar pegadinhas.

> 💡 **Dica**: Configure sua Gemini API key nas configurações para conteúdo gerado especificamente para este tópico.

\`\`\`mermaid
graph TD
    A["${topic}"] --> B["Fundamentos Legais"]
    A --> C["Aplicação Prática"]
    A --> D["Pontos Relevantes"]
    
    B --> B1["Legislação Nacional"]
    B --> B2["Normas Técnicas"]
    
    C --> C1["Casos de Uso"]
    C --> C2["Estudo de Provas"]
    
    D --> D1["Resumos Didáticos"]
    D --> D2["Questões Resolvidas"]
    
    style A fill:#7b2cbf,stroke:#5a6b8c,stroke-width:2px,color:#fff
    style B fill:#131924,stroke:#7b2cbf,color:#fff
    style C fill:#131924,stroke:#7b2cbf,color:#fff
    style D fill:#131924,stroke:#7b2cbf,color:#fff
\`\`\``;
}

function generateMockQuestions(discipline, topic, count) {
  const questions = [];
  for (let i = 0; i < Math.min(count, 5); i++) {
    questions.push({
      stem: `[DEMO] Questão ${i + 1} sobre ${topic} (${discipline}). Configure a API key Gemini para questões reais geradas por IA.`,
      options: {
        A: 'Primeira alternativa de demonstração',
        B: 'Segunda alternativa de demonstração',
        C: 'Terceira alternativa correta de demonstração',
        D: 'Quarta alternativa de demonstração',
      },
      correct: 'C',
      explanation: 'Esta é uma questão de demonstração. Configure a Gemini API key para questões reais baseadas no conteúdo programático e nas provas anexadas.',
      difficulty: 2,
    });
  }
  return questions;
}

function generateMockAnalysis() {
  return {
    patterns: ['Questões sobre LGPD são frequentes', 'Lógica proposicional recorrente', 'Matemática financeira básica'],
    topTopics: [
      { discipline: 'Legislação', topic: 'LGPD', frequency: 8, difficulty: 2 },
      { discipline: 'Lógica', topic: 'Proposições', frequency: 6, difficulty: 2 },
      { discipline: 'Matemática', topic: 'Porcentagem', frequency: 5, difficulty: 1 },
    ],
    commonMistakes: ['Confundir controlador e operador na LGPD', 'Erros em silogismos'],
    questionTypes: ['Certo/Errado', 'Múltipla escolha', 'Completar lacuna'],
    recommendations: ['Priorize LGPD e ISO 27001', 'Pratique lógica diariamente'],
  };
}

async function fixMermaidDiagram(brokenChart) {
  const model = getModel();

  if (!model) {
    return { content: brokenChart };
  }

  const prompt = `Você recebeu um código de diagrama do Mermaid (sintaxe flowchart do tipo graph TD ou graph LR) que está gerando erros de renderização gráfica devido a problemas de sintaxe.
Seu papel é corrigir e retornar APENAS o código Mermaid válido e corrigido, sem qualquer formatação markdown adicional, blocos de código (como \`\`\`mermaid) ou textos explicativos.

Aqui está o código do diagrama com erro:
${brokenChart}

Instruções importantes para a correção:
1. Certifique-se de que a sintaxe básica esteja correta. Por exemplo: "graph TD" ou "graph LR".
2. Certifique-se de que os IDs dos nós contenham apenas caracteres alfanuméricos e sublinhados/hifens. Exemplo correto: no1["Texto do Nó"]. Evite usar caracteres especiais, acentos ou símbolos nos IDs.
3. Certifique-se de fechar todos os delimitadores de nós corretamente, por exemplo, colchetes [], parênteses () ou chaves {}.
4. Evite usar aspas aninhadas de forma incorreta. Rótulos de nós com aspas devem ser formatados como no1["Texto com aspas"].
5. Certifique-se de que as conexões (setas) usem a sintaxe correta, por exemplo: "-->" ou "---" ou "==>". Não use setas com formatos inválidos.
6. Retorne APENAS o código do diagrama Mermaid corrigido e limpo.`;

  try {
    const result = await model.generateContent(prompt);
    let content = result.response.text();
    // Limpar possíveis blocos de código markdown que o modelo insista em retornar
    content = content.replace(/```mermaid/g, '').replace(/```/g, '').trim();
    return { content };
  } catch (error) {
    console.error('[GEMINI API ERROR] Falha ao corrigir diagrama Mermaid:', error.message);
    return { content: brokenChart, error: error.message };
  }
}

module.exports = {
  generatePreReading,
  generateQuestions,
  generateErrorExplanation,
  analyzeExamPapers,
  fixMermaidDiagram,
};
