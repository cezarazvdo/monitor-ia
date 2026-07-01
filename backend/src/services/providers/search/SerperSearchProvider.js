/**
 * SerperSearchProvider — implementação de SearchProvider usando a Serper API (Google Search).
 */
const fetch = require('node-fetch');
const SearchProvider = require('./SearchProvider');
const { logSearchComplete, logSearchError } = require('../../../observability/logger');

class SerperSearchProvider extends SearchProvider {
  constructor(apiKey = process.env.SERPER_API_KEY) {
    super();
    this.apiKey = apiKey;
    this.endpoint = 'https://google.serper.dev/search';
  }

  get name() { return 'serper'; }

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
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: numResults, gl: 'br', hl: 'pt' }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const results = (data.organic || []).slice(0, numResults).map(r => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
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

module.exports = SerperSearchProvider;
