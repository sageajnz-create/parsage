import React, { useState, useEffect } from 'react';
import { RoomState } from '../types';
import {
  Monitor, Radio, Play, StopCircle, Copy, Check, Users,
  ArrowRight, Trash2, Plus
} from 'lucide-react';
import { createQuickLink, listDevices, registerDevice, removeDevice, type DeviceRecord } from '../api/account';

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
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [deviceName, setDeviceName] = useState(`${typeof navigator !== 'undefined' ? navigator.platform : 'linux'} host`);

  useEffect(() => {
    listDevices().then(setDevices).catch(() => setDevices([]));
  }, []);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinRoom(joinCode.trim().toUpperCase());
  };

  const handleRemoveComputer = async (id: string) => {
    await removeDevice(id);
    setDevices(prev => prev.filter(pc => pc.id !== id));
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const device = await registerDevice({ name: deviceName, platform: navigator.platform });
    setDevices(prev => [device, ...prev]);
  };

  const copyRoomLink = async () => {
    if (!roomState) return;
    try {
      const created = await createQuickLink(roomState.roomCode);
      const url = `${window.location.origin}${created.url}`;
      await navigator.clipboard.writeText(url);
      setLinkToken(created.token);
      setCopied(true);
      setLinkError(null);
      setTimeout(() => setCopied(false), 2500);
    } catch (error: any) {
      setLinkError(error.message || 'Unable to create an expiring share link.');
    }
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
          <label htmlFor="room-code" className="sr-only">Room code</label>
          <input
            id="room-code"
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
                    {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                    <span>{copied ? 'Expiring link copied' : `Share expiring link (${roomState.roomCode})`}</span>
                  </button>
                  {onStopHosting && (
                    <button className="btn btn-danger" onClick={onStopHosting} style={{ padding: '10px 14px' }} aria-label="Stop hosting">
                      <StopCircle size={18} aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
              <button className="btn btn-secondary" onClick={onOpenSettings} style={{ padding: '10px 14px' }} aria-label="Open host settings">
                ⚙️
              </button>
            </div>
            {linkError && <p role="alert" style={{ color: 'var(--reggae-red-bright)', fontSize: '0.8rem', marginTop: '10px' }}>{linkError}</p>}
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--zion-teal-bright)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} aria-hidden="true" /> YOUR SAVED DEVICES
          </h3>
        </div>

        <form onSubmit={handleRegisterDevice} className="card" style={{ padding: '16px 18px', marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <label htmlFor="device-name" className="sr-only">Device name</label>
            <input
            id="device-name"
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="This computer's name"
            style={{ flex: 1, minWidth: '220px', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px 14px', borderRadius: '8px' }}
          />
          <button type="submit" className="btn btn-secondary">
            <Plus size={16} aria-hidden="true" />
            <span>Register this computer</span>
          </button>
        </form>

        {devices.length === 0 ? (
          <div className="card" style={{
            background: 'var(--bg-input)',
            borderRadius: '10px',
            padding: '36px 24px',
            textAlign: 'center',
            border: '1px dashed var(--border-muted)'
          }}>
            <Monitor size={42} color="var(--border-muted)" style={{ margin: '0 auto 12px auto' }} aria-hidden="true" />
            <h4 style={{ fontSize: '1.05rem', color: 'var(--fg-bright)', marginBottom: '4px' }}>No Saved Computers</h4>
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
              Register this host in the durable store so it survives app restarts. Friends you add can see when it is hosting.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {devices.map((pc) => (
              <div key={pc.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }} aria-hidden="true">
                        💻
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--fg-bright)' }}>{pc.name}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{pc.platform}{pc.gpu ? ` · ${pc.gpu}` : ''}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveComputer(pc.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer' }}
                      aria-label={`Remove ${pc.name}`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '6px', marginTop: '12px', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--fg-muted)' }}>{pc.roomCode ? `Hosting ${pc.roomCode}` : 'Idle'}</span>
                    <span style={{ color: 'var(--reggae-green-bright)', fontWeight: 'bold' }}>{new Date(pc.lastSeen).toLocaleString()}</span>
                  </div>
                </div>

                {pc.roomCode && (
                  <button
                    className="btn btn-primary"
                    onClick={() => onJoinRoom(pc.roomCode!)}
                    style={{ width: '100%', padding: '9px' }}
                  >
                    <Play size={16} aria-hidden="true" />
                    <span>Connect to {pc.name}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
