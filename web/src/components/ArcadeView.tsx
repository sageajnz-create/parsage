import React, { useState } from 'react';
import { ArcadeSession } from '../types';
import { Gamepad2, Users, Play, Plus, Flame, Sparkles } from 'lucide-react';

interface ArcadeViewProps {
  onJoinRoom: (roomCode: string) => void;
  onHostArcade: () => void;
}

export const ArcadeView: React.FC<ArcadeViewProps> = ({ onJoinRoom, onHostArcade }) => {
  const [sessions, setSessions] = useState<ArcadeSession[]>([]);

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
            Browse active multiplayer lobbies or host your own couch co-op session.
          </p>
        </div>

        <button className="btn btn-primary" onClick={onHostArcade} style={{ padding: '10px 18px' }}>
          <Plus size={18} />
          <span>Host an Arcade Room</span>
        </button>
      </div>

      {/* Arcade Party Grid / Empty State */}
      {sessions.length === 0 ? (
        <div className="card" style={{
          background: 'var(--bg-input)',
          borderRadius: '10px',
          padding: '48px 24px',
          textAlign: 'center',
          border: '1px dashed var(--border-muted)'
        }}>
          <Gamepad2 size={48} color="var(--border-muted)" style={{ margin: '0 auto 16px auto' }} />
          <h4 style={{ fontSize: '1.15rem', color: 'var(--fg-bright)', marginBottom: '6px' }}>No Active Arcade Lobbies</h4>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 20px auto' }}>
            There are no public arcade co-op rooms open right now. Click below to host your game and invite friends!
          </p>
          <button className="btn btn-primary" onClick={onHostArcade} style={{ padding: '10px 20px' }}>
            <Plus size={16} />
            <span>Host an Arcade Room</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {sessions.map((session) => (
            <div
              key={session.id}
              className="card"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                border: '1px solid var(--border-muted)'
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
      )}
    </div>
  );
};
