import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getProfile, type Profile } from '../lib/api';
import { useFontScale } from '../lib/useFontScale';

const navItems = [
  { href: '/', icon: '🏠', label: 'Dashboard' },
  { href: '/study', icon: '📚', label: 'Estudar Agora' },
  { href: '/calendar', icon: '📅', label: 'Calendário' },
  { href: '/stats', icon: '📊', label: 'Estatísticas' },
  { href: '/upload', icon: '📁', label: 'Documentos' },
  { href: '/settings', icon: '⚙️', label: 'Configurações' },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { label, increase, decrease, canIncrease, canDecrease } = useFontScale();

  useEffect(() => {
    getProfile().then(setProfile).catch(console.error);
  }, []);

  const btnBase: React.CSSProperties = {
    background: 'var(--bg-overlay)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    transition: 'all var(--transition)',
    flexShrink: 0,
    fontFamily: 'var(--font-sans)',
  };

  const isCritical = !!(profile && profile.totalPlannedWorkdays > 0 && (profile.remainingWorkdays / profile.totalPlannedWorkdays) < 0.20);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          display: 'none',
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 200,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '8px 10px',
          cursor: 'pointer',
          fontSize: 18,
          color: 'var(--text-primary)',
        }}
        id="mobile-menu-btn"
        aria-label="Menu"
      >
        ☰
      </button>

      <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <h1>Monitor IA</h1>
          <p>Plataforma de Estudos</p>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-label">Navegação</span>
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`nav-item${pathname === item.href ? ' active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          {profile && (
            <>
              <div style={{ marginBottom: 12 }}>
                <div className="xp-bar-container">
                  <div className="xp-bar-header">
                    <span>Nível {profile.level}</span>
                    <span>{profile.xp} XP</span>
                  </div>
                  <div className="xp-bar-track">
                    <div className="xp-bar-fill" style={{ width: `${profile.levelProgress}%` }} />
                  </div>
                </div>
              </div>
              {profile.streak > 0 && (
                <div className="streak-pill">
                  🔥 {profile.streak} {profile.streak === 1 ? 'dia' : 'dias'}
                </div>
              )}
            </>
          )}

          {/* ── Controle de tamanho de fonte ── */}
          <div style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-subtle)',
          }}>
            <span style={{
              fontSize: 10,
              color: 'var(--text-disabled)',
              flex: 1,
              fontWeight: 500,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}>
              Fonte
            </span>
            <button
              id="font-decrease"
              onClick={decrease}
              disabled={!canDecrease}
              title="Diminuir fonte"
              style={{
                ...btnBase,
                opacity: canDecrease ? 1 : 0.3,
                cursor: canDecrease ? 'pointer' : 'default',
              }}
            >
              A−
            </button>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--accent)',
              minWidth: 20,
              textAlign: 'center',
            }}>
              {label}
            </span>
            <button
              id="font-increase"
              onClick={increase}
              disabled={!canIncrease}
              title="Aumentar fonte"
              style={{
                ...btnBase,
                opacity: canIncrease ? 1 : 0.3,
                cursor: canIncrease ? 'pointer' : 'default',
              }}
            >
              A+
            </button>
          </div>

          <div style={{
            marginTop: 8,
            fontSize: 11,
            fontWeight: isCritical ? 700 : 500,
            color: isCritical ? 'var(--error)' : 'var(--text-disabled)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: isCritical ? '6px 10px' : '0',
            background: isCritical ? 'var(--error-dim)' : 'transparent',
            borderRadius: 'var(--radius)',
            border: isCritical ? '1px dashed rgba(239, 68, 68, 0.4)' : 'none',
            transition: 'all var(--transition)',
          }}>
            {profile ? (
              <>
                <span>📅 {profile.remainingWorkdays} dias úteis</span>
                {isCritical && <span title="Fase crítica! Menos de 20% do tempo restante." style={{ cursor: 'help' }}>⚠️</span>}
              </>
            ) : ''}
          </div>
        </div>
      </aside>
    </>
  );
}
