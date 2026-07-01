/**
 * GeminiProvider — implementação de LLMProvider usando Google Gemini.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const LLMProvider = require('./LLMProvider');
const { logLLMCall, logLLMError } = require('../../../observability/logger');

const DEFAULT_MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Você é um assistente especializado em preparação para concursos públicos brasileiros.
Seu papel é gerar conteúdo didático de alta qualidade, objetivo e focado.
Sempre responda em português do Brasil.
Para questões, siga o padrão das bancas de concurso (CESPE, FGV, Vunesp, etc.).
Priorize Legislação (LGPD, ISO 27001/27002, Marco Civil), Lógica e Matemática.`;

class GeminiProvider extends LLMProvider {
  constructor(apiKey = process.env.GEMINI_API_KEY, modelId = DEFAULT_MODEL) {
    super();
    this.apiKey = apiKey;
    this._modelId = modelId;
    this._client = null;
  }

  get modelId() { return this._modelId; }

  isConfigured() { return !!this.apiKey; }

  _getClient() {
    if (!this._client && this.isConfigured()) {
      this._client = new GoogleGenerativeAI(this.apiKey);
    }
    return this._client;
  }

  _getModel(options = {}) {
    const client = this._getClient();
    if (!client) return null;
    return client.getGenerativeModel({
      model: this._modelId,
      systemInstruction: SYSTEM_PROMPT,
      ...options,
    });
  }

  /**
   * Duplica o texto do prompt antes do envio — padrão de reforço de instruções.
   * @param {string} prompt
   * @returns {string}
   */
  _doublePrompt(prompt) {
    const separator = '\n\n---\n[REPETIÇÃO DAS INSTRUÇÕES — siga rigorosamente o que foi pedido acima]\n---\n\n';
    return `${prompt}${separator}${prompt}`;
  }

  async generate(prompt, options = {}) {
    const model = this._getModel();
    if (!model) throw new Error('GeminiProvider não configurado (GEMINI_API_KEY ausente)');

    const t0 = Date.now();
    const doubledPrompt = this._doublePrompt(prompt);
    try {
      const result = await model.generateContent(doubledPrompt);
      const text = result.response.text();
      logLLMCall({
        model: this._modelId,
        purpose: options.purpose || 'generate',
        promptTokensEstimate: Math.ceil(doubledPrompt.length / 4),
        durationMs: Date.now() - t0,
      });
      return text;
    } catch (err) {
      logLLMError({ model: this._modelId, purpose: options.purpose || 'generate', error: err });
      throw err;
    }
  }

  async generateJSON(prompt, options = {}) {
    const model = this._getModel();
    if (!model) throw new Error('GeminiProvider não configurado (GEMINI_API_KEY ausente)');

    const t0 = Date.now();
    const doubledPrompt = this._doublePrompt(prompt);
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: doubledPrompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      });
      const text = result.response.text();
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      logLLMCall({
        model: this._modelId,
        purpose: options.purpose || 'generateJSON',
        promptTokensEstimate: Math.ceil(doubledPrompt.length / 4),
        durationMs: Date.now() - t0,
      });
      return parsed;
    } catch (err) {
      logLLMError({ model: this._modelId, purpose: options.purpose || 'generateJSON', error: err });
      throw err;
    }
  }
}

module.exports = GeminiProvider;
