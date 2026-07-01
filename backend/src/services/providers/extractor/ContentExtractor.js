/**
 * ContentExtractor — interface/contrato para extratores de conteúdo de páginas web.
 */
class ContentExtractor {
  /**
   * Extrai o conteúdo principal de uma URL.
   * @param {string} url
   * @returns {Promise<{url: string, text: string, success: boolean, error?: string}>}
   */
  async extract(url) {
    throw new Error('ContentExtractor.extract() deve ser implementado pela subclasse');
  }

  get name() { return 'ContentExtractor'; }
}

module.exports = ContentExtractor;
