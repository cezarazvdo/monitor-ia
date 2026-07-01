/**
 * CheerioExtractor — implementação de ContentExtractor usando Cheerio para scraping.
 * Migração da função scrapeContent do search.service.js para a arquitetura de providers.
 */
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const ContentExtractor = require('./ContentExtractor');
const { logExtractionComplete } = require('../../../observability/logger');

const MAX_CHARS = 3000;
const TIMEOUT_MS = 8000;

class CheerioExtractor extends ContentExtractor {
  get name() { return 'cheerio'; }

  async extract(url) {
    const t0 = Date.now();
    try {
      const response = await fetch(url, {
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorIA/1.0)' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remover elementos não-conteúdo
      $('script, style, nav, footer, header, aside, .menu, .nav, .sidebar, .ads, .advertisement').remove();

      const text = $('article, main, .content, .post-content, .entry-content, body')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_CHARS);

      logExtractionComplete({ url, chars: text.length, durationMs: Date.now() - t0 });
      return { url, text, success: true };
    } catch (err) {
      return { url, text: '', success: false, error: err.message };
    }
  }
}

module.exports = CheerioExtractor;
