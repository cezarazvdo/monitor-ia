require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Garantir que as pastas existam
const dataDir = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : './data';
const uploadsDir = process.env.UPLOADS_PATH || './uploads';
[dataDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Inicializar DB
const { initDatabase } = require('./db/database');
initDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

// Rotas
app.use('/api/ai', require('./routes/ai'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/search', require('./routes/search'));
app.use('/api/gamification', require('./routes/gamification'));

// Health check
app.get('/api/health', (req, res) => {
  const { getDb } = require('./db/database');
  const db = getDb();
  const profile = db.prepare('SELECT exam_date FROM user_profile WHERE id = 1').get();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasGemini: !!process.env.GEMINI_API_KEY,
    hasSerper: !!process.env.SERPER_API_KEY,
    examDate: profile?.exam_date || process.env.EXAM_DATE || '2026-10-19',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Monitor IA Backend rodando em http://localhost:${PORT}`);
  console.log(`📊 Gemini: ${process.env.GEMINI_API_KEY ? '✅ Configurado' : '⚠️  Não configurado (modo demo)'}`);
  console.log(`🔍 Serper: ${process.env.SERPER_API_KEY ? '✅ Configurado' : '⚠️  Não configurado (busca desativada)'}`);
  
  try {
    const { getDb } = require('./db/database');
    const db = getDb();
    const profile = db.prepare('SELECT exam_date FROM user_profile WHERE id = 1').get();
    console.log(`📅 Concurso: ${profile?.exam_date || process.env.EXAM_DATE || '2026-10-19'}\n`);
  } catch (e) {
    console.log(`📅 Concurso: ${process.env.EXAM_DATE || '2026-10-19'}\n`);
  }
});

module.exports = app;
