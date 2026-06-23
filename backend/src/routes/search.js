const express = require('express');
const router = express.Router();
const { searchSerper, searchLegislation, scrapeContent } = require('../services/search.service');

// GET /api/search?q=...&type=general|legislation — busca web
router.get('/', async (req, res, next) => {
  try {
    const { q, type = 'general' } = req.query;
    if (!q) return res.status(400).json({ error: 'Parâmetro q é obrigatório' });

    let results;
    if (type === 'legislation') {
      results = await searchLegislation(q);
    } else {
      results = await searchSerper(`${q} concurso público`, 6);
    }

    res.json({ query: q, results, hasApiKey: !!process.env.SERPER_API_KEY });
  } catch (err) {
    next(err);
  }
});

// POST /api/search/scrape — buscar conteúdo de URL
router.post('/scrape', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

    const result = await scrapeContent(url);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
