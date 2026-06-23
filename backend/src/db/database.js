const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/monitor-ia.db';
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  const db = getDb();

  db.exec(`
    -- Perfil do usuário
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT DEFAULT 'Estudante',
      exam_date TEXT DEFAULT '2026-10-19',
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_study_date TEXT,
      discipline_weights TEXT DEFAULT '{"legislacao":40,"logica":35,"matematica":25}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Inserir perfil padrão se não existir
    INSERT OR IGNORE INTO user_profile (id) VALUES (1);

    -- Sessões de estudo
    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      discipline TEXT NOT NULL,
      topic TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'pre_reading',
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      duration_seconds INTEGER DEFAULT 0,
      xp_earned INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active'
    );

    -- Questões geradas
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      discipline TEXT NOT NULL,
      topic TEXT NOT NULL,
      stem TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      difficulty INTEGER DEFAULT 2,
      source TEXT DEFAULT 'ai',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES study_sessions(id)
    );

    -- Respostas do usuário
    CREATE TABLE IF NOT EXISTS user_answers (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      selected_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      time_taken_seconds INTEGER DEFAULT 0,
      answered_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (question_id) REFERENCES questions(id),
      FOREIGN KEY (session_id) REFERENCES study_sessions(id)
    );

    -- Documentos enviados
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      type TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      text_content TEXT,
      processed INTEGER DEFAULT 0,
      uploaded_at TEXT DEFAULT (datetime('now'))
    );

    -- Badges conquistados
    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      badge_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      earned_at TEXT DEFAULT (datetime('now'))
    );

    -- Log diário
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      studied INTEGER DEFAULT 0,
      sessions_count INTEGER DEFAULT 0,
      questions_answered INTEGER DEFAULT 0,
      correct_answers INTEGER DEFAULT 0,
      xp_earned INTEGER DEFAULT 0,
      disciplines TEXT DEFAULT '{}'
    );

    -- Tópicos com dificuldade (spaced repetition)
    CREATE TABLE IF NOT EXISTS topic_difficulty (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discipline TEXT NOT NULL,
      topic TEXT NOT NULL,
      subtopic TEXT,
      error_count INTEGER DEFAULT 0,
      attempt_count INTEGER DEFAULT 0,
      last_seen TEXT,
      next_review TEXT,
      UNIQUE(discipline, topic, subtopic)
    );

    -- Análise das provas
    CREATE TABLE IF NOT EXISTS exam_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discipline TEXT NOT NULL,
      topic TEXT NOT NULL,
      frequency INTEGER DEFAULT 1,
      difficulty_avg REAL DEFAULT 2.0,
      patterns TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log('[DB] Banco de dados inicializado com sucesso');
}

module.exports = { getDb, initDatabase };
