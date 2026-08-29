import React, { useState, useEffect } from 'react';
import { RoomState, SavedComputer } from '../types';
import {
  Monitor, Radio, Play, StopCircle, Copy, Check, Users,
  Zap, Share2, Plus, ExternalLink, ArrowRight, Shield, Trash2
} from 'lucide-react';

interface ComputersViewProps {
  roomState: RoomState | null;
  isHost: boolean;
  onStartHosting: () => void;
  onStopHosting?: () => void;
  onJoinRoom: (roomCode: string) => void;
  onOpenSettings: () => void;
  pendingJoinCode?: string | null;
  errorMsg?: string | null;
}

const STORAGE_KEY = 'parsage_saved_computers';

export const ComputersView: React.FC<ComputersViewProps> = ({
  roomState,
  isHost,
  onStartHosting,
  onStopHosting,
  onJoinRoom,
  onOpenSettings,
  pendingJoinCode,
  errorMsg
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedPcs, setSavedPcs] = useState<SavedComputer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPcs));
    } catch (e) {}
  }, [savedPcs]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinRoom(joinCode.trim().toUpperCase());
  };

  const handleRemoveComputer = (id: string) => {
    setSavedPcs(prev => prev.filter(pc => pc.id !== id));
  };

  const copyRoomLink = () => {
    if (!roomState) return;
    const url = `${window.location.origin}/?join=${roomState.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {pendingJoinCode && !errorMsg && (
        <div className="card" style={{ padding: '14px 18px', border: '1px solid var(--reggae-gold)', color: 'var(--reggae-gold)' }}>
          Connecting to <strong>{pendingJoinCode}</strong>… waiting for the host to approve this viewer.
        </div>
      )}
      {errorMsg && (
        <div style={{ background: 'rgba(232, 17, 45, 0.15)', border: '1px solid var(--reggae-red)', color: 'var(--reggae-red-bright)', padding: '14px 18px', borderRadius: '8px' }}>
          {errorMsg}
        </div>
      )}
      {/* Top Banner / Join Input */}
      <div className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Connect & Play</h2>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.88rem', marginTop: '2px' }}>
            Host your Linux games or connect to friends' rigs with zero router configuration.
          </p>
        </div>

        {/* Quick Room Code Connect Bar */}
        <form onSubmit={handleJoinSubmit} style={{ display: 'flex', gap: '8px', minWidth: '340px' }}>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter Room Code (e.g. PARSAGE-R4STA-7K9M2QXP)"
            style={{
              flex: 1,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-muted)',
              color: 'var(--reggae-gold-bright)',
              padding: '10px 14px',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}
          />
          <button type="submit" className="btn btn-primary" disabled={!joinCode.trim()}>
            <span>Connect</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>

      {/* YOUR COMPUTERS (Host Rig) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--reggae-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Monitor size={18} /> YOUR COMPUTERS
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {/* Main Linux Rig Card */}
          <div className="card" style={{ padding: '24px', border: roomState ? '2px solid var(--reggae-green)' : '1px solid var(--border-muted)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem'
                }}>
                  🖥️
                </div>
                <div>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--fg-bright)' }}>
                    Omarchy Gaming Rig
                  </h4>
                  <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span>AMD Radeon RX 6650 XT (VA-API)</span>
                  </div>
                </div>
              </div>

              <span className={`badge ${roomState ? 'badge-green' : 'badge-reggae'}`}>
                {roomState ? '⚡ Broadcasting' : 'Ready to Host'}
              </span>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '12px 14px', borderRadius: '8px', marginBottom: '18px', fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <span style={{ color: 'var(--fg-muted)' }}>Display Server:</span>{' '}
                <strong style={{ color: 'var(--fg-main)' }}>Wayland / Hyprland</strong>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted)' }}>Audio Capture:</span>{' '}
                <strong style={{ color: 'var(--reggae-green-bright)' }}>PipeWire 1.6</strong>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted)' }}>Virtual Gamepads:</span>{' '}
                <strong style={{ color: 'var(--reggae-gold)' }}>4x Xbox 360</strong>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted)' }}>HW Encoder:</span>{' '}
                <strong style={{ color: 'var(--zion-teal-bright)' }}>VA-API H.264</strong>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {!roomState ? (
                <button className="btn btn-primary" onClick={onStartHosting} style={{ flex: 1 }}>
                  <Radio size={18} />
                  <span>Host / Share Desktop</span>
                </button>
              ) : (
                <>
                  <button className="btn btn-success" onClick={copyRoomLink} style={{ flex: 1 }}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copied ? 'Link Copied!' : `Share (${roomState.roomCode})`}</span>
                  </button>
                  {onStopHosting && (
                    <button className="btn btn-danger" onClick={onStopHosting} style={{ padding: '10px 14px' }}>
                      <StopCircle size={18} />
                    </button>
                  )}
                </>
              )}
              <button className="btn btn-secondary" onClick={onOpenSettings} style={{ padding: '10px 14px' }}>
                ⚙️
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* COMPUTERS SHARED WITH YOU */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--zion-teal-bright)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} /> COMPUTERS SHARED WITH YOU
          </h3>
        </div>

        {savedPcs.length === 0 ? (
          <div className="card" style={{
            background: 'var(--bg-input)',
            borderRadius: '10px',
            padding: '36px 24px',
            textAlign: 'center',
            border: '1px dashed var(--border-muted)'
          }}>
            <Monitor size={42} color="var(--border-muted)" style={{ margin: '0 auto 12px auto' }} />
            <h4 style={{ fontSize: '1.05rem', color: 'var(--fg-bright)', marginBottom: '4px' }}>No Shared Computers</h4>
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
              When a friend shares a session with you, or when you join via a room code, you can save their PC here for instant 1-click connecting.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {savedPcs.map((pc) => (
              <div key={pc.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                        💻
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--fg-bright)' }}>{pc.name}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Owner: {pc.ownerName}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveComputer(pc.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer' }}
                      title="Remove Saved Computer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '6px', marginTop: '12px', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--fg-muted)' }}>{pc.gpu}</span>
                    <span style={{ color: 'var(--reggae-green-bright)', fontWeight: 'bold' }}>{pc.pingMs} ms</span>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => onJoinRoom(pc.roomCode)}
                  style={{ width: '100%', padding: '9px' }}
                >
                  <Play size={16} />
                  <span>Connect to {pc.ownerName}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
