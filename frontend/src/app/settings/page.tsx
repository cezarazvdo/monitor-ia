import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { getProfile, updateProfile, getHealth, type Profile, type HealthCheck } from '../../lib/api';

const DISCIPLINE_LIST = [
  { key: 'legislacao', label: 'Legislação', emoji: '⚖️' },
  { key: 'logica', label: 'Lógica', emoji: '🧠' },
  { key: 'matematica', label: 'Matemática', emoji: '📐' },
  { key: 'informatica', label: 'Informática', emoji: '💻' },
  { key: 'portugues', label: 'Português', emoji: '📖' },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('2026-10-19');
  const [weights, setWeights] = useState<Record<string, number>>({ legislacao: 40, logica: 35, matematica: 25 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([getProfile(), getHealth()]).then(([p, h]) => {
      setProfile(p);
      setHealth(h);
      setName(p.name);
      setExamDate(p.examDate);
      setWeights(p.disciplineWeights);
    }).catch(console.error);
  }, []);

  function handleWeightChange(key: string, value: number) {
    setWeights(prev => ({ ...prev, [key]: value }));
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({ name, disciplineWeights: weights, examDate });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>⚙️ Configurações</h1>
          <p>Personalize sua experiência de estudo</p>
        </div>

        {/* System status */}
        <div className="card" style={{ marginBottom: 'var(--space-6)', borderLeft: health?.status === 'ok' ? '3px solid var(--success)' : '3px solid var(--error)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-4)' }}>🖥️ Status do Sistema</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', fontSize: 13 }}>
            {[
              { label: 'Backend', ok: !!health, icon: '🖥️' },
              { label: 'Gemini', ok: !!health?.hasGemini, icon: '♊' },
              { label: 'Serper (Busca)', ok: !!health?.hasSerper, icon: '🔍' },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                background: s.ok ? 'var(--success-dim)' : 'var(--error-dim)',
                borderRadius: 'var(--radius)',
              }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.label}</div>
                  <div style={{ color: s.ok ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                    {s.ok ? '✅ Ativo' : '❌ Não configurado'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!health?.hasGemini && (
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--warning-dim)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--warning)' }}>
              ⚠️ Configure <code>GEMINI_API_KEY</code> no arquivo <code>backend/.env</code> para habilitar geração de conteúdo com IA. Sem ela, o sistema usa conteúdo de demonstração.
            </div>
          )}
        </div>

        <div className="grid-2">
          {/* Profile settings */}
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-5)' }}>👤 Perfil</h2>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>
                Nome
              </label>
              <input
                id="input-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  width: '100%',
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
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>
                Data do Concurso
              </label>
              <input
                id="input-exam-date"
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-3) var(--space-4)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  outline: 'none',
                  colorScheme: 'dark',
                }}
              />
            </div>

            {profile && (
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>XP Total</span>
                  <span style={{ fontWeight: 600 }}>{profile.xp}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Nível</span>
                  <span style={{ fontWeight: 600 }}>{profile.level}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Maior sequência</span>
                  <span style={{ fontWeight: 600 }}>🔥 {profile.longestStreak} dias</span>
                </div>
              </div>
            )}
          </div>

          {/* Discipline weights */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>⚖️ Peso das Disciplinas</h2>
              <span style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: totalWeight === 100 ? 'var(--success-dim)' : 'var(--warning-dim)',
                color: totalWeight === 100 ? 'var(--success)' : 'var(--warning)',
                fontWeight: 600,
              }}>
                {totalWeight}% {totalWeight !== 100 ? '⚠️' : '✓'}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
              Total deve ser 100%. Disciplinas com maior peso aparecem mais frequentemente.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {DISCIPLINE_LIST.map(d => (
                <div key={d.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{d.emoji} {d.label}</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-hover)' }}>{weights[d.key] || 0}%</span>
                  </div>
                  <input
                    id={`slider-${d.key}`}
                    type="range"
                    min={0}
                    max={100}
                    value={weights[d.key] || 0}
                    onChange={e => handleWeightChange(d.key, parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: 'var(--accent)',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* API Keys info */}
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-4)' }}>🔑 Configuração das APIs</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            As chaves de API são configuradas no arquivo <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>backend/.env</code>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 13 }}>
            <div style={{ padding: 'var(--space-4)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
              <div><span style={{ color: 'var(--text-tertiary)' }}># Obtenha em aistudio.google.com</span></div>
              <div>GEMINI_API_KEY=AIzaSy...</div>
              <div style={{ marginTop: 8 }}><span style={{ color: 'var(--text-tertiary)' }}># Obtenha em serper.dev</span></div>
              <div>SERPER_API_KEY=...</div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div style={{ marginTop: 'var(--space-8)', display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-primary btn-lg" id="btn-save-settings" onClick={handleSave} disabled={saving || totalWeight !== 100}>
            {saving ? '⏳ Salvando...' : saved ? '✅ Salvo!' : '💾 Salvar Configurações'}
          </button>
          {totalWeight !== 100 && (
            <span style={{ fontSize: 13, color: 'var(--warning)', alignSelf: 'center' }}>
              ⚠️ O total dos pesos deve ser exatamente 100%
            </span>
          )}
        </div>
      </main>
    </div>
  );
}
