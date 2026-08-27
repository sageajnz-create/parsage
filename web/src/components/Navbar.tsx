import React from 'react';
import { MainView } from '../types';
import { Monitor, Gamepad2, Users, Settings, Activity, Wifi, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  currentTab: MainView;
  onSelectTab: (tab: MainView) => void;
  wsConnected: boolean;
  roomCode?: string | null;
  latencyMs?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  wsConnected,
  roomCode,
  latencyMs
}) => {
  return (
    <header style={{
      background: 'rgba(27, 26, 23, 0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-muted)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '12px 24px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Brand & Credits */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => onSelectTab('computers')}>
            <span style={{ fontSize: '1.8rem', filter: 'drop-shadow(0 0 8px rgba(30, 181, 58, 0.5))' }}>🌿</span>
            <div>
              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                lineHeight: 1
              }} className="reggae-gradient-text">
                PARSAGE
              </h1>
              <span style={{
                fontSize: '0.65rem',
                color: 'var(--fg-muted)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                fontWeight: 600
              }}>
                Low Latency Game & Desktop Stream
              </span>
            </div>
          </div>

          <div className="badge badge-reggae" style={{ fontSize: '0.7rem', padding: '4px 10px' }}>
            <ShieldCheck size={13} color="var(--reggae-gold)" />
            <span>Created by <strong>Sage & Antigravity</strong></span>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-input)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-muted)' }}>
          <button
            className={`btn ${currentTab === 'computers' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 14px', fontSize: '0.85rem' }}
            onClick={() => onSelectTab('computers')}
          >
            <Monitor size={16} />
            <span>Computers</span>
          </button>

          <button
            className={`btn ${currentTab === 'arcade' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 14px', fontSize: '0.85rem' }}
            onClick={() => onSelectTab('arcade')}
          >
            <Gamepad2 size={16} />
            <span>Arcade</span>
          </button>

          <button
            className={`btn ${currentTab === 'friends' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 14px', fontSize: '0.85rem' }}
            onClick={() => onSelectTab('friends')}
          >
            <Users size={16} />
            <span>Friends</span>
          </button>

          <button
            className={`btn ${currentTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 14px', fontSize: '0.85rem' }}
            onClick={() => onSelectTab('settings')}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </nav>

        {/* Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {roomCode && (
            <div className="badge badge-green">
              <span>ROOM: <strong>{roomCode}</strong></span>
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-card)',
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid var(--border-muted)',
            fontSize: '0.8rem'
          }}>
            <div className={wsConnected ? 'pulse-dot' : ''} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: wsConnected ? 'var(--reggae-green)' : 'var(--reggae-red)'
            }} />
            <Wifi size={14} color={wsConnected ? 'var(--reggae-green)' : 'var(--reggae-red)'} />
            <span>{wsConnected ? 'Signal Ready' : 'Connecting...'}</span>
            {latencyMs !== undefined && latencyMs > 0 && (
              <span style={{ color: 'var(--reggae-gold)', fontWeight: 'bold', marginLeft: '4px' }}>
                {latencyMs}ms
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
