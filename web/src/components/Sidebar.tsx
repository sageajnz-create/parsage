import React from 'react';
import { MainView, UserProfile } from '../types';
import {
  Monitor, Gamepad2, Users, Settings, Activity,
  ShieldCheck, Wifi, LogIn, Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentView: MainView;
  onSelectView: (view: MainView) => void;
  profile: UserProfile;
  onOpenAuth: () => void;
  wsConnected: boolean;
  isHost: boolean;
  latencyMs?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  profile,
  onOpenAuth,
  wsConnected,
  isHost,
  latencyMs
}) => {
  const getStatusColor = (status: UserProfile['status']) => {
    if (isHost) return 'var(--reggae-gold)';
    if (status === 'online') return 'var(--reggae-green)';
    if (status === 'in-game') return 'var(--zion-teal)';
    return 'var(--fg-muted)';
  };

  return (
    <aside style={{
      width: '260px',
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border-muted)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      userSelect: 'none'
    }}>
      {/* Top Header & Brand */}
      <div>
        <div
          onClick={() => onSelectView('computers')}
          style={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            borderBottom: '1px solid var(--border-muted)'
          }}
        >
          <span style={{ fontSize: '2rem', filter: 'drop-shadow(0 0 10px rgba(30, 181, 58, 0.6))' }}>🌿</span>
          <div>
            <h1 className="reggae-gradient-text" style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
              PARSAGE
            </h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
              Game & Desktop Stream
            </span>
          </div>
        </div>

        {/* Profile Card / Login Trigger */}
        <div
          onClick={onOpenAuth}
          style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            borderBottom: '1px solid rgba(74, 69, 54, 0.4)',
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="Click to edit profile or sign in with Google"
        >
          <div style={{ position: 'relative' }}>
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '2px solid var(--reggae-gold)',
                objectFit: 'cover',
                background: '#151412'
              }}
            />
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: getStatusColor(profile.status),
              border: '2px solid var(--bg-card)'
            }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--fg-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile.name}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                #{profile.tag}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: getStatusColor(profile.status), fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isHost ? '⚡ Hosting Session' : profile.status === 'online' ? '● Online' : profile.status}
              {profile.isGoogleAuth && <span style={{ color: 'var(--reggae-gold)', fontSize: '0.65rem' }}>✓ Google</span>}
            </div>
          </div>
        </div>

        {/* Parsec Main Navigation Menu */}
        <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            onClick={() => onSelectView('computers')}
            className={`btn ${currentView === 'computers' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', padding: '10px 16px', fontSize: '0.9rem', border: 'none' }}
          >
            <Monitor size={18} />
            <span>Computers</span>
          </button>

          <button
            onClick={() => onSelectView('arcade')}
            className={`btn ${currentView === 'arcade' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', padding: '10px 16px', fontSize: '0.9rem', border: 'none' }}
          >
            <Gamepad2 size={18} />
            <span>Arcade & Co-op</span>
          </button>

          <button
            onClick={() => onSelectView('friends')}
            className={`btn ${currentView === 'friends' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', padding: '10px 16px', fontSize: '0.9rem', border: 'none' }}
          >
            <Users size={18} />
            <span>Friends</span>
          </button>

          <button
            onClick={() => onSelectView('settings')}
            className={`btn ${currentView === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', padding: '10px 16px', fontSize: '0.9rem', border: 'none' }}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>

          <button
            onClick={() => onSelectView('diagnostics')}
            className={`btn ${currentView === 'diagnostics' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', padding: '10px 16px', fontSize: '0.9rem', border: 'none' }}
          >
            <Activity size={18} />
            <span>Diagnostics</span>
          </button>
        </nav>
      </div>

      {/* Bottom Footer Details */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-muted)', background: 'var(--bg-deep)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className={wsConnected ? 'pulse-dot' : ''} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: wsConnected ? 'var(--reggae-green)' : 'var(--reggae-red)'
            }} />
            <span style={{ color: wsConnected ? 'var(--reggae-green-bright)' : 'var(--reggae-red)' }}>
              {wsConnected ? 'Signal Ready' : 'Reconnecting...'}
            </span>
          </div>

          {latencyMs !== undefined && latencyMs > 0 && (
            <span style={{ color: 'var(--reggae-gold)', fontWeight: 'bold' }}>{latencyMs} ms</span>
          )}
        </div>

        <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', lineHeight: '1.4' }}>
          <div>Parsage <strong>v0.2.0</strong></div>
          <div style={{ color: 'var(--reggae-gold)', marginTop: '2px' }}>Created by <strong>Sage & Antigravity</strong></div>
        </div>
      </div>
    </aside>
  );
};
