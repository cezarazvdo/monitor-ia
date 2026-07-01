/**
 * SearchProvider — interface/contrato para provedores de busca.
 * Todos os providers devem implementar esta interface.
 */
class SearchProvider {
  /**
   * Executa uma busca e retorna resultados normalizados.
   * @param {string} query
   * @param {number} numResults
   * @returns {Promise<Array<{title: string, url: string, snippet: string, source: string}>>}
   */
  async search(query, numResults = 5) {
    throw new Error('SearchProvider.search() deve ser implementado pela subclasse');
  }

  /**
   * Informa se o provider está configurado (tem API key válida, etc.).
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('SearchProvider.isConfigured() deve ser implementado pela subclasse');
  }

  /** Nome legível do provider para logs */
  get name() {
    return 'SearchProvider';
  }
}

module.exports = SearchProvider;
