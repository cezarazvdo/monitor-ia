/**
 * LLMProvider — interface/contrato para provedores de modelos de linguagem.
 * Todos os providers devem implementar esta interface.
 */
class LLMProvider {
  /**
   * Gera texto a partir de um prompt.
   * @param {string} prompt
   * @param {object} options - { temperature, maxTokens, systemPrompt }
   * @returns {Promise<string>}
   */
  async generate(prompt, options = {}) {
    throw new Error('LLMProvider.generate() deve ser implementado pela subclasse');
  }

  /**
   * Gera uma resposta em JSON estruturado.
   * @param {string} prompt
   * @param {object} options
   * @returns {Promise<object>}
   */
  async generateJSON(prompt, options = {}) {
    throw new Error('LLMProvider.generateJSON() deve ser implementado pela subclasse');
  }

  /**
   * Informa se o provider está configurado (tem API key válida, etc.).
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('LLMProvider.isConfigured() deve ser implementado pela subclasse');
  }

  /** Nome e versão do modelo para logs e auditoria */
  get modelId() {
    return 'LLMProvider';
  }
}

module.exports = LLMProvider;
