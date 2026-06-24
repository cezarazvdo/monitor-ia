import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getProfile, type Profile } from '../lib/api';

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

  useEffect(() => {
    getProfile().then(setProfile).catch(console.error);
  }, []);

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
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-disabled)' }}>
            {profile ? `📅 ${profile.remainingWorkdays} dias úteis` : ''}
          </div>
        </div>
      </aside>
    </>
  );
}
