import React, { useState } from 'react';
import { ArcadeSession } from '../types';
import { Gamepad2, Users, Play, Plus, Flame, Sparkles, Filter } from 'lucide-react';

interface ArcadeViewProps {
  onJoinRoom: (roomCode: string) => void;
  onHostArcade: () => void;
}

const ARCADE_SESSIONS: ArcadeSession[] = [
  {
    id: 'arc-1',
    roomCode: 'PARSAGE-SMASH-777',
    gameTitle: 'Super Smash Bros Ultimate (Co-op)',
    hostName: 'Sage',
    hostAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sage&backgroundColor=1b1a17',
    currentPlayers: 2,
    maxPlayers: 4,
    pingMs: 8,
    resolution: '1080p',
    fps: 60
  },
  {
    id: 'arc-2',
    roomCode: 'PARSAGE-TEKKEN-001',
    gameTitle: 'Tekken 8 (Versus Lobby)',
    hostName: 'KazuyaFan',
    hostAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Kazuya&backgroundColor=1b1a17',
    currentPlayers: 1,
    maxPlayers: 2,
    pingMs: 14,
    resolution: '1080p',
    fps: 120
  },
  {
    id: 'arc-3',
    roomCode: 'PARSAGE-COOK-888',
    gameTitle: 'Overcooked! All You Can Eat',
    hostName: 'ChefOmar',
    hostAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Chef&backgroundColor=1b1a17',
    currentPlayers: 3,
    maxPlayers: 4,
    pingMs: 11,
    resolution: '1080p',
    fps: 60
  },
  {
    id: 'arc-4',
    roomCode: 'PARSAGE-MARIO-999',
    gameTitle: 'Mario Kart 8 Deluxe (4-Player Grand Prix)',
    hostName: 'LuigiKing',
    hostAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Luigi&backgroundColor=1b1a17',
    currentPlayers: 2,
    maxPlayers: 4,
    pingMs: 18,
    resolution: '1440p',
    fps: 60
  }
];

export const ArcadeView: React.FC<ArcadeViewProps> = ({ onJoinRoom, onHostArcade }) => {
  const [filter, setFilter] = useState<'all' | 'coop' | 'versus'>('all');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Banner */}
      <div className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Gamepad2 size={26} color="var(--reggae-gold)" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Parsage Arcade</h2>
          </div>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.88rem', marginTop: '2px' }}>
            Browse live local multiplayer lobbies or host your own couch co-op session.
          </p>
        </div>

        <button className="btn btn-primary" onClick={onHostArcade} style={{ padding: '10px 18px' }}>
          <Plus size={18} />
          <span>Host an Arcade Session</span>
        </button>
      </div>

      {/* Arcade Party Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {ARCADE_SESSIONS.map((session) => (
          <div
            key={session.id}
            className="card"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px',
              border: '1px solid var(--border-muted)',
              transition: 'transform 0.15s ease, border-color 0.15s ease'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span className="badge badge-reggae" style={{ fontSize: '0.7rem' }}>
                  <Flame size={12} color="var(--reggae-gold)" />
                  <span>{session.roomCode}</span>
                </span>

                <span style={{ color: 'var(--reggae-green-bright)', fontWeight: 'bold', fontSize: '0.82rem' }}>
                  {session.pingMs} ms
                </span>
              </div>

              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--fg-bright)', marginBottom: '8px' }}>
                {session.gameTitle}
              </h4>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                <img
                  src={session.hostAvatar}
                  alt={session.hostName}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border-muted)' }}
                />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--fg-main)' }}>
                    Host: {session.hostName}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
                    {session.resolution} @ {session.fps}fps
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Status & Join Button */}
            <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <Users size={15} color="var(--reggae-gold)" />
                <span style={{ fontWeight: 'bold', color: 'var(--reggae-gold)' }}>
                  {session.currentPlayers}/{session.maxPlayers} Players
                </span>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => onJoinRoom(session.roomCode)}
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                <Play size={14} />
                <span>Join Game</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
