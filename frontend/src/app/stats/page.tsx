import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { getStats, searchWeb, type Stats, type SearchResult } from '../../lib/api';

const DISCIPLINE_LABELS: Record<string, string> = {
  legislacao: 'Legislação', logica: 'Lógica', matematica: 'Matemática',
  informatica: 'Informática', portugues: 'Português',
};
const DISCIPLINE_EMOJIS: Record<string, string> = {
  legislacao: '⚖️', logica: '🧠', matematica: '📐', informatica: '💻', portugues: '📖',
};

const DISCIPLINE_COLORS: Record<string, string> = {
  legislacao: 'var(--legislacao)', logica: 'var(--logica)', matematica: 'var(--matematica)',
  informatica: 'var(--informatica)', portugues: 'var(--portugues)',
};

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchType, setSearchType] = useState<'general' | 'legislation'>('legislation');

  useEffect(() => {
    getStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const result = await searchWeb(searchQuery, searchType);
      setSearchResults(result.results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  const QUICK_SEARCHES = [
    { label: 'LGPD Art. 1-10', q: 'LGPD Lei 13709 artigos princípios', type: 'legislation' },
    { label: 'ISO 27001', q: 'ISO IEC 27001 SGSI requisitos', type: 'legislation' },
    { label: 'Marco Civil', q: 'Marco Civil Internet Lei 12965', type: 'legislation' },
    { label: 'Lógica Proposicional', q: 'lógica proposicional concurso questões', type: 'general' },
  ];

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>📊 Estatísticas</h1>
          <p>Desempenho detalhado, pontos de atenção e busca de fontes confiáveis</p>
        </div>

        {/* Overall totals */}
        {stats && (
          <div className="grid-4" style={{ marginBottom: 'var(--space-8)' }}>
            <div className="stat-card">
              <span className="stat-label">⏱️ Horas Estudadas</span>
              <span className="stat-value">{stats.totals.studyHours}</span>
              <span className="stat-sub">horas no total</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">📝 Sessões</span>
              <span className="stat-value">{stats.totals.sessions}</span>
              <span className="stat-sub">sessões completas</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">✅ Hoje</span>
              <span className="stat-value">{stats.todayAnswers.total > 0 ? Math.round(stats.todayAnswers.correct / stats.todayAnswers.total * 100) : 0}%</span>
              <span className="stat-sub">{stats.todayAnswers.correct}/{stats.todayAnswers.total} corretas</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">🎯 Geral</span>
              <span className="stat-value">
                {stats.byDiscipline.length > 0
                  ? Math.round(stats.byDiscipline.reduce((a, d) => a + d.rate, 0) / stats.byDiscipline.length)
                  : 0}%
              </span>
              <span className="stat-sub">taxa média</span>
            </div>
          </div>
        )}

        <div className="grid-2" style={{ marginBottom: 'var(--space-8)' }}>
          {/* Discipline performance */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-5)' }}>📈 Desempenho por Disciplina</h2>
            {loading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : stats?.byDiscipline && stats.byDiscipline.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {stats.byDiscipline.map(d => (
                  <div key={d.discipline}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {DISCIPLINE_EMOJIS[d.discipline]} {DISCIPLINE_LABELS[d.discipline] || d.discipline}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>{d.correct}/{d.total}</span>
                        <span style={{
                          fontWeight: 700, fontSize: 16,
                          color: d.rate >= 70 ? 'var(--success)' : d.rate >= 50 ? 'var(--warning)' : 'var(--error)',
                        }}>{d.rate}%</span>
                      </div>
                    </div>
                    <div className="progress-bar" style={{ height: 8 }}>
                      <div className="progress-fill" style={{
                        width: `${d.rate}%`,
                        background: DISCIPLINE_COLORS[d.discipline] || 'var(--accent)',
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 4 }}>
                      Tempo médio por questão: {d.avgTime}s
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon">📊</div>
                <p>Complete sessões para ver estatísticas</p>
              </div>
            )}
          </div>

          {/* Weak topics */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-5)' }}>⚠️ Tópicos para Reforçar</h2>
            {stats?.weakTopics && stats.weakTopics.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {stats.weakTopics.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius)',
                    borderLeft: `3px solid ${t.error_rate > 60 ? 'var(--error)' : 'var(--warning)'}`,
                  }}>
                    <div style={{
                      minWidth: 44,
                      fontWeight: 800,
                      fontSize: 16,
                      color: t.error_rate > 60 ? 'var(--error)' : 'var(--warning)',
                      textAlign: 'center',
                    }}>
                      {Math.round(t.error_rate)}%
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{t.topic}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {DISCIPLINE_LABELS[t.discipline] || t.discipline} · {t.error_count} erros em {t.attempt_count} tentativas
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon">🎉</div>
                <h3>Ótimo desempenho!</h3>
                <p>Sem pontos de atenção críticos ainda</p>
              </div>
            )}
          </div>
        </div>

        {/* Daily progress */}
        {stats?.dailyData && stats.dailyData.length > 0 && (
          <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-5)' }}>📅 Últimos 14 Dias</h2>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
              {stats.dailyData.map((day, i) => {
                const maxXP = Math.max(...stats.dailyData.map(d => d.xp_earned), 100);
                const height = day.studied ? Math.max(12, (day.xp_earned / maxXP) * 80) : 4;
                return (
                  <div key={i} title={`${day.date}: ${day.xp_earned} XP`} style={{
                    flex: 1,
                    height,
                    background: day.studied ? 'linear-gradient(180deg, var(--accent), var(--accent-hover))' : 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'height 600ms ease',
                    cursor: 'default',
                    minWidth: 0,
                  }} />
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-disabled)' }}>
              <span>{stats.dailyData[0]?.date?.slice(5)}</span>
              <span>{stats.dailyData[stats.dailyData.length - 1]?.date?.slice(5)}</span>
            </div>
          </div>
        )}

        {/* Web search */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-2)' }}>🔍 Busca em Fontes Confiáveis</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
            Planalto, Lexml, normas ISO, artigos acadêmicos — pesquise legislação diretamente aqui
          </p>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Ex: LGPD Art. 18, ISO 27001 controles..."
              style={{
                flex: 1,
                background: 'var(--bg-elevated)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3) var(--space-4)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <select
              value={searchType}
              onChange={e => setSearchType(e.target.value as any)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
              }}
            >
              <option value="legislation">⚖️ Legislação</option>
              <option value="general">🔍 Geral</option>
            </select>
            <button className="btn btn-primary" type="submit" id="btn-search" disabled={searching}>
              {searching ? '⏳' : '🔍 Buscar'}
            </button>
          </form>

          {/* Quick searches */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
            {QUICK_SEARCHES.map(s => (
              <button
                key={s.label}
                className="btn btn-ghost btn-sm"
                onClick={() => { setSearchQuery(s.q); setSearchType(s.type as any); }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {searchResults.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: 'var(--space-4)',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    textDecoration: 'none',
                    transition: 'all var(--transition)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent-hover)', marginBottom: 4 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.snippet}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 4 }}>{r.url}</div>
                </a>
              ))}
            </div>
          )}

          {searchResults.length === 0 && !searching && searchQuery && (
            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
              <div className="empty-state-icon">🔎</div>
              <p>Nenhum resultado. Configure a Serper API key para buscas reais.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
