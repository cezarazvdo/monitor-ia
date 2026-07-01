const fetch = require('node-fetch');
const cheerio = require('cheerio');
const SerperSearchProvider = require('./providers/search/SerperSearchProvider');
const TavilySearchProvider = require('./providers/search/TavilySearchProvider');
const CheerioExtractor = require('./providers/extractor/CheerioExtractor');

// Instâncias singleton dos providers
const serperProvider = new SerperSearchProvider();
const tavilyProvider = new TavilySearchProvider();
const contentExtractor = new CheerioExtractor();

// Busca via Serper API (Google Search) — mantida para compatibilidade retroativa
async function searchSerper(query, numResults = 5) {
  if (!process.env.SERPER_API_KEY) {
    return searchFallback(query);
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: numResults, gl: 'br', hl: 'pt' }),
    });

    const data = await response.json();
    const results = (data.organic || []).map(r => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      source: 'serper',
    }));

    return results;
  } catch (err) {
    console.error('[Search] Erro Serper:', err.message);
    return searchFallback(query);
  }
}

// Busca por legislação específica (fontes confiáveis) — mantida para compatibilidade
async function searchLegislation(topic) {
  const sources = [];

  const legalQueries = [
    `site:planalto.gov.br ${topic}`,
    `site:lexml.gov.br ${topic}`,
    `${topic} concurso público questões`,
  ];

  for (const query of legalQueries) {
    const results = await searchSerper(query, 3);
    sources.push(...results);
  }

  return sources.slice(0, 8);
}

// Scraping de conteúdo de uma URL — mantida para compatibilidade retroativa
async function scrapeContent(url) {
  try {
    const response = await fetch(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorIA/1.0)' },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    $('script, style, nav, footer, header, aside, .menu, .nav, .sidebar').remove();

    const text = $('article, main, .content, .post-content, body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    return { url, text, success: true };
  } catch (err) {
    return { url, text: '', success: false, error: err.message };
  }
}

/**
 * ragEnrichContext — Camada RAG: busca e extrai conteúdo de múltiplos providers
 * para enriquecer o contexto enviado ao pipeline de geração de pré-leitura.
 *
 * @param {object} params
 * @param {string} params.topic - Tópico principal
 * @param {string} [params.subtopic] - Subtópico opcional
 * @param {string} [params.discipline] - Disciplina (ex: 'legislacao')
 * @param {string} [params.banca] - Banca do concurso (ex: 'CESPE')
 * @param {number} [params.maxResults=4] - Máximo de resultados por provider
 * @param {boolean} [params.extractContent=false] - Se deve extrair conteúdo das páginas
 * @returns {Promise<Array<{title, url, snippet, content, source, queriedAt}>>}
 */
async function ragEnrichContext({ topic, subtopic = '', discipline = '', banca = '', maxResults = 4, extractContent = false }) {
  const queriedAt = new Date().toISOString();
  const query = `${topic} ${subtopic} concurso público`.replace(/\s+/g, ' ').trim();

  const allResults = [];

  // Buscar em todos os providers configurados
  const providers = [serperProvider, tavilyProvider].filter(p => p.isConfigured());

  for (const provider of providers) {
    const results = await provider.search(query, maxResults).catch(() => []);
    allResults.push(...results);
  }

  // Se nenhum provider configurado, usar fallback
  if (allResults.length === 0) {
    allResults.push(...searchFallback(`${topic} ${discipline}`));
  }

  // Deduplicar por URL
  const seen = new Set();
  const deduplicated = allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  }).slice(0, maxResults * 2);

  // Opcionalmente extrair conteúdo completo das páginas (top 3 URLs)
  if (extractContent && deduplicated.length > 0) {
    const topUrls = deduplicated.slice(0, 3);
    const extracted = await Promise.allSettled(topUrls.map(r => contentExtractor.extract(r.url)));
    extracted.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value.success) {
        topUrls[i].content = result.value.text;
      }
    });
  }

  return deduplicated.map(r => ({ ...r, queriedAt }));
}

// Fallback quando não há API key
function searchFallback(query) {
  const mockSources = [
    {
      title: 'LGPD — Lei Geral de Proteção de Dados Pessoais',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',
      snippet: 'Lei nº 13.709, de 14 de Agosto de 2018. Dispõe sobre a proteção de dados pessoais...',
      source: 'fallback',
    },
    {
      title: 'ISO/IEC 27001 — Sistemas de Gestão de Segurança da Informação',
      url: 'https://www.abnt.org.br/normalizacao/lista-de-publicacoes/abnt',
      snippet: 'Norma que especifica os requisitos para estabelecer, implementar, manter e melhorar continuamente um SGSI...',
      source: 'fallback',
    },
    {
      title: 'Marco Civil da Internet — Lei 12.965/2014',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm',
      snippet: 'Estabelece princípios, garantias, direitos e deveres para o uso da Internet no Brasil...',
      source: 'fallback',
    },
  ];

  return mockSources.filter(s =>
    query.toLowerCase().split(' ').some(word =>
      s.title.toLowerCase().includes(word) || s.snippet.toLowerCase().includes(word)
    )
  ).slice(0, 3) || mockSources.slice(0, 2);
}

module.exports = { searchSerper, searchLegislation, scrapeContent, ragEnrichContext };
