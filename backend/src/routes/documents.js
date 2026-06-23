const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { extractTextFromPDF, cleanText } = require('../services/pdf.service');

const uploadsDir = process.env.UPLOADS_PATH || './uploads';

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Apenas PDF, TXT e MD são permitidos'));
  },
});

// POST /api/documents/upload — upload de documento
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const { type = 'apoio' } = req.body; // tipos: prova, gabarito, edital, apoio
    const db = getDb();
    const id = uuidv4();
    const ext = path.extname(req.file.originalname).toLowerCase();

    db.prepare(`
      INSERT INTO documents (id, filename, original_name, type, size_bytes, processed)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(id, req.file.filename, req.file.originalname, type, req.file.size);

    // Processar em background
    setImmediate(async () => {
      try {
        let textContent = '';
        if (ext === '.pdf') {
          const result = await extractTextFromPDF(req.file.path);
          textContent = cleanText(result.text);
        } else {
          const fs = require('fs');
          textContent = fs.readFileSync(req.file.path, 'utf8');
        }

        db.prepare('UPDATE documents SET text_content = ?, processed = 1 WHERE id = ?')
          .run(textContent.slice(0, 100000), id);

        console.log(`[DOC] Processado: ${req.file.originalname} (${textContent.length} chars)`);
      } catch (err) {
        console.error('[DOC] Erro ao processar:', err.message);
        db.prepare('UPDATE documents SET processed = -1 WHERE id = ?').run(id);
      }
    });

    // Gamificação: +20 XP por upload
    const profile = db.prepare('SELECT xp FROM user_profile WHERE id = 1').get();
    db.prepare('UPDATE user_profile SET xp = ? WHERE id = 1').run((profile?.xp || 0) + 20);

    res.json({
      id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      type,
      size: req.file.size,
      status: 'processing',
      xpEarned: 20,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents — listar documentos
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const docs = db.prepare(`
      SELECT id, filename, original_name, type, size_bytes, processed, uploaded_at
      FROM documents
      ORDER BY uploaded_at DESC
    `).all();

    res.json(docs.map(d => ({
      id: d.id,
      filename: d.filename,
      originalName: d.original_name,
      type: d.type,
      size: d.size_bytes,
      status: d.processed === 1 ? 'done' : d.processed === -1 ? 'error' : 'processing',
      uploadedAt: d.uploaded_at,
    })));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id — remover documento
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const doc = db.prepare('SELECT filename FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });

    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);

    const fs = require('fs');
    const filePath = path.join(uploadsDir, doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id/status — status do processamento
router.get('/:id/status', (req, res, next) => {
  try {
    const db = getDb();
    const doc = db.prepare('SELECT id, processed, original_name FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Não encontrado' });

    res.json({
      id: doc.id,
      name: doc.original_name,
      status: doc.processed === 1 ? 'done' : doc.processed === -1 ? 'error' : 'processing',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
