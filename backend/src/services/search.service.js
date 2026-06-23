const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Busca via Serper API (Google Search)
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

// Busca por legislação específica (fontes confiáveis)
async function searchLegislation(topic) {
  const sources = [];

  // Planalto.gov.br para leis
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

// Scraping de conteúdo de uma URL
async function scrapeContent(url) {
  try {
    const response = await fetch(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorIA/1.0)' },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove scripts, styles, nav, footer
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

module.exports = { searchSerper, searchLegislation, scrapeContent };
