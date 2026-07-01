/**
 * OpenAIProvider — stub preparado para expansão futura.
 * Ative configurando OPENAI_API_KEY no .env.
 */
const LLMProvider = require('./LLMProvider');

class OpenAIProvider extends LLMProvider {
  constructor(apiKey = process.env.OPENAI_API_KEY, modelId = 'gpt-4o') {
    super();
    this.apiKey = apiKey;
    this._modelId = modelId;
  }

  get modelId() { return this._modelId; }

  isConfigured() { return !!this.apiKey; }

  async generate(prompt, options = {}) {
    if (!this.isConfigured()) throw new Error('OpenAIProvider não configurado (OPENAI_API_KEY ausente)');
    // TODO: implementar com 'openai' npm package quando necessário
    throw new Error('OpenAIProvider.generate() ainda não implementado');
  }

  async generateJSON(prompt, options = {}) {
    if (!this.isConfigured()) throw new Error('OpenAIProvider não configurado (OPENAI_API_KEY ausente)');
    // TODO: implementar com response_format: { type: 'json_object' }
    throw new Error('OpenAIProvider.generateJSON() ainda não implementado');
  }
}

module.exports = OpenAIProvider;
