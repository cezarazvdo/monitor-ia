import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { getProfile, getStats, getTodaySession, type Profile, type Stats, type TodaySession } from '../lib/api';

const DISCIPLINE_LABELS: Record<string, string> = {
  legislacao: 'Legislação',
  logica: 'Lógica',
  matematica: 'Matemática',
  informatica: 'Informática',
  portugues: 'Português',
};

const DISCIPLINE_EMOJIS: Record<string, string> = {
  legislacao: '⚖️',
  logica: '🧠',
  matematica: '📐',
  informatica: '💻',
  portugues: '📖',
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [today, setToday] = useState<TodaySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getProfile(), getStats(), getTodaySession()])
      .then(([p, s, t]) => { setProfile(p); setStats(s); setToday(t); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="main-content">
          <div className="loading-center">
            <div className="spinner" />
            <p>Carregando dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="main-content">
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <h3>Backend offline</h3>
            <p>Certifique-se que o servidor está rodando em <code>localhost:3001</code></p>
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-disabled)' }}>{error}</p>
          </div>
        </main>
      </div>
    );
  }

  const today_acc = stats?.todayAnswers;
  const todayRate = today_acc && today_acc.total > 0
    ? Math.round(today_acc.correct / today_acc.total * 100)
    : null;

  const totalDays = profile?.totalPlannedWorkdays || 100;
  const ratio = profile ? (profile.remainingWorkdays / totalDays) : 1;
  const isCritical = ratio < 0.20;

  const urgency = isCritical ? 'high' : ratio < 0.40 ? 'medium' : 'low';
  const urgencyColor = { high: 'var(--error)', medium: 'var(--warning)', low: 'var(--success)' }[urgency];

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1>Olá, {profile?.name || 'Estudante'} 👋</h1>
            <p>
              {today?.alreadyStudied
                ? '✅ Você já estudou hoje! Continue assim.'
                : 'Pronto para estudar? Vamos lá!'}
            </p>
          </div>
          <Link to="/study" className="btn btn-primary btn-lg" id="start-study-btn">
            {today?.alreadyStudied ? '📚 Mais uma sessão' : '🚀 Iniciar Estudo'}
          </Link>
        </div>

        {/* Warning Banner for critical time limit (under 20% remaining) */}
        {isCritical && (
          <div style={{
            background: 'var(--error-dim)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4) var(--space-5)',
            marginBottom: 'var(--space-8)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            boxShadow: '0 0 15px rgba(239, 68, 68, 0.1)',
          }}>
            <span style={{ fontSize: 24 }}>🚨</span>
            <div>
              <strong style={{ color: 'var(--error)', display: 'block', marginBottom: 2 }}>Fase Crítica do Cronograma!</strong>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Resta menos de <strong>20%</strong> do tempo útil previsto para a sua prova (apenas <strong>{profile?.remainingWorkdays}</strong> de <strong>{profile?.totalPlannedWorkdays}</strong> dias úteis restantes). Intensifique seu ritmo de estudos!
              </span>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid-4" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="stat-card card-accent">
            <span className="stat-label">🔥 Sequência</span>
            <span className="stat-value">{profile?.streak ?? 0}</span>
            <span className="stat-sub">dias consecutivos</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">⭐ Nível</span>
            <span className="stat-value">{profile?.level ?? 1}</span>
            <span className="stat-sub">{profile?.xp ?? 0} XP total</span>
          </div>
          <div className="stat-card" style={{
            borderColor: isCritical ? 'rgba(239, 68, 68, 0.6)' : undefined,
            boxShadow: isCritical ? '0 0 20px rgba(239, 68, 68, 0.2)' : undefined,
            background: isCritical ? 'rgba(239, 68, 68, 0.05)' : undefined,
          }}>
            <span className="stat-label" style={{ color: isCritical ? 'var(--error)' : undefined, fontWeight: isCritical ? 700 : undefined }}>
              📅 Dias Úteis {isCritical && '⚠️'}
            </span>
            <span className="stat-value" style={{ color: urgencyColor }}>{profile?.remainingWorkdays ?? '—'}</span>
            <span className="stat-sub" style={{ color: isCritical ? 'var(--error)' : undefined, fontWeight: isCritical ? 600 : undefined }}>
              {isCritical ? 'Fase Crítica!' : 'até o concurso'}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">🎯 Hoje</span>
            <span className="stat-value">{todayRate !== null ? `${todayRate}%` : '—'}</span>
            <span className="stat-sub">
              {today_acc && today_acc.total > 0
                ? `${today_acc.correct}/${today_acc.total} corretas`
                : 'nenhuma questão ainda'}
            </span>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid-2" style={{ gap: 'var(--space-6)' }}>
          {/* Today's plan */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-5)' }}>📋 Plano de Hoje</h2>
            {today ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                }}>
                  <span style={{ fontSize: 36 }}>{DISCIPLINE_EMOJIS[today.suggestedDiscipline] || '📚'}</span>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>Disciplina sugerida</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{DISCIPLINE_LABELS[today.suggestedDiscipline] || today.suggestedDiscipline}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{today.suggestedTopic}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span>⏱️ ~45 minutos</span>
                  <span>·</span>
                  <span>📝 10 questões</span>
                  <span>·</span>
                  <span>🎯 +100 XP</span>
                </div>
                <Link to="/study" className="btn btn-primary w-full" style={{ textAlign: 'center' }}>
                  Começar Sessão
                </Link>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <p>Carregando plano...</p>
              </div>
            )}
          </div>

          {/* Discipline performance */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-5)' }}>📊 Desempenho por Disciplina</h2>
            {stats?.byDiscipline && stats.byDiscipline.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {stats.byDiscipline.map(d => (
                  <div key={d.discipline}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>
                        {DISCIPLINE_EMOJIS[d.discipline]} {DISCIPLINE_LABELS[d.discipline] || d.discipline}
                      </span>
                      <span style={{
                        fontWeight: 700,
                        color: d.rate >= 70 ? 'var(--success)' : d.rate >= 50 ? 'var(--warning)' : 'var(--error)',
                      }}>
                        {d.rate}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${d.rate}%`,
                        background: d.rate >= 70
                          ? 'linear-gradient(90deg, var(--success), #4ade80)'
                          : d.rate >= 50
                            ? 'linear-gradient(90deg, var(--warning), #fcd34d)'
                            : 'linear-gradient(90deg, var(--error), #f87171)',
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 3 }}>
                      {d.correct}/{d.total} questões
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon">📊</div>
                <p>Complete sessões para ver seu desempenho</p>
              </div>
            )}
          </div>

          {/* Weak topics */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-5)' }}>⚠️ Pontos de Atenção</h2>
            {stats?.weakTopics && stats.weakTopics.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {stats.weakTopics.slice(0, 5).map((t, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius)',
                  }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius)',
                      background: 'var(--error-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--error)',
                      flexShrink: 0,
                    }}>
                      {Math.round(t.error_rate)}%
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.topic}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {DISCIPLINE_LABELS[t.discipline] || t.discipline} · {t.error_count}/{t.attempt_count} erros
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon">🎉</div>
                <p>Nenhum ponto de atenção ainda!</p>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-5)' }}>🏆 Conquistas</h2>
            {profile?.badges && profile.badges.length > 0 ? (
              <div className="badge-grid">
                {profile.badges.map(b => (
                  <div key={b.id} className="badge-item">
                    <div className="badge-icon">{b.name.split(' ')[0]}</div>
                    <div className="badge-name">{b.name.split(' ').slice(1).join(' ')}</div>
                    <div className="badge-desc">{b.description}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon">🏆</div>
                <h3>Sem conquistas ainda</h3>
                <p>Complete sessões para ganhar badges!</p>
              </div>
            )}
          </div>
        </div>

        {/* XP progress */}
        {profile && (
          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Progresso para Nível {profile.level + 1}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{profile.xpToNextLevel} XP para o próximo nível</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--accent-hover)' }}>{profile.xp} XP</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Maior sequência: {profile.longestStreak} dias</div>
              </div>
            </div>
            <div className="xp-bar-track" style={{ height: 10 }}>
              <div className="xp-bar-fill" style={{ width: `${profile.levelProgress}%` }} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
