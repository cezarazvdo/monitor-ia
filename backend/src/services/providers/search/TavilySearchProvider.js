/**
 * TavilySearchProvider — stub preparado para expansão futura.
 * Ative configurando TAVILY_API_KEY no .env.
 * Documentação: https://docs.tavily.com/
 */
const fetch = require('node-fetch');
const SearchProvider = require('./SearchProvider');
const { logSearchComplete, logSearchError } = require('../../../observability/logger');

class TavilySearchProvider extends SearchProvider {
  constructor(apiKey = process.env.TAVILY_API_KEY) {
    super();
    this.apiKey = apiKey;
    this.endpoint = 'https://api.tavily.com/search';
  }

  get name() { return 'tavily'; }

  isConfigured() {
    return !!this.apiKey;
  }

  async search(query, numResults = 5) {
    if (!this.isConfigured()) return [];

    const t0 = Date.now();
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results: numResults,
          search_depth: 'basic',
          include_answer: false,
          include_domains: ['planalto.gov.br', 'lexml.gov.br', 'gov.br'],
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const results = (data.results || []).slice(0, numResults).map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.slice(0, 300) || '',
        source: this.name,
      }));

      logSearchComplete({ provider: this.name, query, resultsCount: results.length, durationMs: Date.now() - t0 });
      return results;
    } catch (err) {
      logSearchError({ provider: this.name, query, error: err });
      return [];
    }
  }
}

module.exports = TavilySearchProvider;
