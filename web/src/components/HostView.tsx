import React, { useState, useEffect, useRef } from 'react';
import { RoomState, PeerInfo, ChatMessage } from '../types';
import {
  Radio, ScreenShare, Copy, Check, Users, Settings2, Play,
  Volume2, Shield, UserX, Gamepad2, MousePointer, Wifi, ShieldAlert,
  UserCheck, Sliders, Monitor, Zap, MessageSquare, Send
} from 'lucide-react';

interface HostViewProps {
  roomState: RoomState | null;
  isHost: boolean;
  localStream: MediaStream | null;
  lanIps: string[];
  chatMessages: ChatMessage[];
  onCreateRoom: (name: string, settings?: any) => void;
  onStartCapture: (fps: number, resolution: string) => Promise<MediaStream | null>;
  onApprovePeer: (peerId: string, slot?: number | null) => void;
  onUpdatePermissions: (peerId: string, permissions: PeerInfo['permissions']) => void;
  onKickPeer: (peerId: string) => void;
  onSendChat: (text: string) => void;
  wsConnected: boolean;
  errorMsg: string | null;
}

export const HostView: React.FC<HostViewProps> = ({
  roomState,
  isHost,
  localStream,
  lanIps,
  chatMessages,
  onCreateRoom,
  onStartCapture,
  onApprovePeer,
  onUpdatePermissions,
  onKickPeer,
  onSendChat,
  wsConnected,
  errorMsg
}) => {
  const [hostName, setHostName] = useState('Sage (Host)');
  const [targetFps, setTargetFps] = useState(60);
  const [resolution, setResolution] = useState('1080p');
  const [maxBitrate, setMaxBitrate] = useState(25);
  const [requireApproval, setRequireApproval] = useState(false);
  const [allowMouseKeyboard, setAllowMouseKeyboard] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedLan, setCopiedLan] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoPreviewRef.current && localStream) {
      videoPreviewRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleCreateRoom = async () => {
    onCreateRoom(hostName, {
      maxBitrateMbps: maxBitrate,
      targetFps,
      resolution,
      requireApproval,
      allowMouseKeyboard
    });
  };

  const handleStartCapture = async () => {
    await onStartCapture(targetFps, resolution);
  };

  const copyRoomLink = () => {
    if (!roomState) return;
    const url = `${window.location.origin}/?join=${roomState.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const copyLanLink = (ip: string) => {
    if (!roomState) return;
    const url = `http://${ip}:7777/?join=${roomState.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLan(true);
    setTimeout(() => setCopiedLan(false), 2500);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  const getSlotColor = (slot: number | null) => {
    if (slot === 0) return 'var(--slot-p1)';
    if (slot === 1) return 'var(--slot-p2)';
    if (slot === 2) return 'var(--slot-p3)';
    if (slot === 3) return 'var(--slot-p4)';
    return 'var(--fg-muted)';
  };

  const pendingPeers = roomState?.peers.filter(p => !p.approved) || [];

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Radio size={28} color="var(--reggae-gold)" />
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Linux Host Stream Center</h2>
          </div>
          <p style={{ color: 'var(--fg-muted)', marginTop: '4px', fontSize: '0.9rem' }}>
            Hardware accelerated desktop & game streaming with full Parsec co-op feature parity on Omarchy Linux.
          </p>
        </div>

        {roomState && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={copyRoomLink}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              <span>{copied ? 'Link Copied!' : `Copy P2P Room Link (${roomState.roomCode})`}</span>
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div style={{ background: 'rgba(232, 17, 45, 0.15)', border: '1px solid var(--reggae-red)', color: 'var(--reggae-red-bright)', padding: '14px 20px', borderRadius: '8px', fontSize: '0.9rem' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Guest Approval Notification Banner */}
      {pendingPeers.length > 0 && (
        <div style={{
          background: 'rgba(255, 199, 44, 0.15)',
          border: '1px solid var(--reggae-gold)',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={22} color="var(--reggae-gold)" />
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--reggae-gold)' }}>Guest Join Request Pending</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--fg-main)' }}>
                {pendingPeers.map(p => p.name).join(', ')} wants to join your session.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {pendingPeers.map(peer => (
              <div key={peer.id} style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-success" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => onApprovePeer(peer.id)}>
                  <UserCheck size={14} />
                  <span>Accept {peer.name} (🎮 Gamepad)</span>
                </button>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => onApprovePeer(peer.id, null)}>
                  <span>Accept as Spectator</span>
                </button>
                <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => onKickPeer(peer.id)}>
                  <UserX size={14} />
                  <span>Decline</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Body */}
      {!roomState ? (
        /* Configuration View */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.1fr) minmax(300px, 0.9fr)', gap: '24px' }}>
          <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--reggae-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings2 size={20} /> Stream Quality & Host Settings
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Host Display Name:
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--fg-main)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                  Target Resolution:
                </label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-muted)',
                    color: 'var(--fg-main)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.95rem'
                  }}
                >
                  <option value="720p">720p (Fast / High FPS)</option>
                  <option value="1080p">1080p (Standard Full HD)</option>
                  <option value="ultrawide">1080p Ultrawide (2560x1080)</option>
                  <option value="1440p">1440p (2K Ultra Quality)</option>
                  <option value="4K">4K (2160p Ultra HD)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                  Target Framerate:
                </label>
                <select
                  value={targetFps}
                  onChange={(e) => setTargetFps(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-muted)',
                    color: 'var(--fg-main)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.95rem'
                  }}
                >
                  <option value={60}>60 FPS (Silky Smooth)</option>
                  <option value={120}>120 FPS (Ultra Low Latency)</option>
                  <option value={144}>144 FPS (Pro Esports)</option>
                  <option value={240}>240 FPS (Maximum Speed)</option>
                  <option value={30}>30 FPS (Bandwidth Saver)</option>
                </select>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                <span>Max Video Bitrate:</span>
                <span style={{ color: 'var(--reggae-gold)', fontWeight: 'bold' }}>{maxBitrate} Mbps</span>
              </div>
              <input
                type="range"
                min={5}
                max={80}
                step={5}
                value={maxBitrate}
                onChange={(e) => setMaxBitrate(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--reggae-gold)' }}
              />
            </div>

            {/* Permission Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-input)', padding: '14px', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                  style={{ accentColor: 'var(--reggae-gold)', width: '16px', height: '16px' }}
                />
                <span><strong>Require Host Approval</strong> before guests can join</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={allowMouseKeyboard}
                  onChange={(e) => setAllowMouseKeyboard(e.target.checked)}
                  style={{ accentColor: 'var(--reggae-green)', width: '16px', height: '16px' }}
                />
                <span><strong>Allow Mouse & Keyboard</strong> sharing for co-working</span>
              </label>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCreateRoom}
              disabled={!wsConnected}
              style={{ padding: '14px' }}
            >
              <Play size={20} />
              <span>Start Hosting Session</span>
            </button>
          </div>

          {/* Feature Parity & LAN Guide */}
          <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--reggae-green-bright)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🌿 Parsec Feature Parity on Linux
            </h3>
            <ul style={{ color: 'var(--fg-main)', fontSize: '0.88rem', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li><strong>Zero Router Config:</strong> WebRTC ICE & STUN hole-punching for seamless NAT traversal.</li>
              <li><strong>Hardware VA-API & NVENC:</strong> Direct hardware frame encoding on AMD Radeon & NVIDIA GPUs.</li>
              <li><strong>4 Virtual Xbox Controllers:</strong> Native Linux <code>/dev/uinput</code> joysticks for local multiplayer.</li>
              <li><strong>Force Feedback / Rumble:</strong> Dual-motor vibration forwarding to client gamepads.</li>
              <li><strong>In-Stream Chat & Reactions:</strong> Floating overlay menu with live party reactions.</li>
              <li><strong>LAN Direct Connect:</strong> 0ms local network discovery for home gaming sessions.</li>
            </ul>

            {lanIps.length > 0 && (
              <div style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>YOUR LOCAL LAN IP:</div>
                <div className="font-mono" style={{ color: 'var(--zion-teal-bright)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  {lanIps.join(', ')}:7777
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active Host Control Room */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.35fr) minmax(300px, 0.65fr)', gap: '24px' }}>
          {/* Stream Preview & Broadcast Details */}
          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--reggae-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ScreenShare size={18} /> Desktop & Game Broadcast
              </h3>
              {!localStream && (
                <button className="btn btn-success" onClick={handleStartCapture} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  <ScreenShare size={16} />
                  <span>Select Game / Display</span>
                </button>
              )}
            </div>

            {/* Video Preview */}
            <div style={{
              background: '#0E0D0B',
              borderRadius: '8px',
              overflow: 'hidden',
              aspectRatio: '16/9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: '1px solid var(--border-muted)'
            }}>
              {localStream ? (
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                  <ScreenShare size={48} color="var(--border-muted)" style={{ marginBottom: '12px' }} />
                  <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                    Click below to choose your game or full monitor stream.
                  </p>
                  <button className="btn btn-primary" onClick={handleStartCapture}>
                    <ScreenShare size={18} />
                    <span>Select Capture Source</span>
                  </button>
                </div>
              )}

              {localStream && (
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  background: 'rgba(27, 26, 23, 0.85)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: 'var(--reggae-green-bright)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <div className="pulse-dot" />
                  <span>Broadcasting ({resolution} @ {targetFps}fps)</span>
                </div>
              )}
            </div>

            {/* Direct Connect LAN Links */}
            {lanIps.length > 0 && (
              <div style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>LAN DIRECT URL (0ms Internet Lag):</span>
                  <div className="font-mono" style={{ color: 'var(--zion-teal-bright)', fontSize: '0.85rem' }}>
                    http://{lanIps[0]}:7777/?join={roomState.roomCode}
                  </div>
                </div>
                <button className="btn btn-secondary" onClick={() => copyLanLink(lanIps[0])} style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                  {copiedLan ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLan ? 'Copied' : 'Copy LAN Link'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Connected Buddies, Slots & In-Session Chat */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 4-Player Slot Matrix */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--reggae-green-bright)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gamepad2 size={18} /> Couch Co-op Slots (P1 - P4)
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[0, 1, 2, 3].map((slotIdx) => {
                  const assignedPeerId = roomState.slots[slotIdx];
                  const peer = roomState.peers.find(p => p.id === assignedPeerId);
                  return (
                    <div
                      key={slotIdx}
                      style={{
                        background: 'var(--bg-input)',
                        border: `1px solid ${getSlotColor(slotIdx)}`,
                        borderRadius: '8px',
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Gamepad2 size={18} color={getSlotColor(slotIdx)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.72rem', color: getSlotColor(slotIdx), fontWeight: 'bold' }}>
                          SLOT P{slotIdx + 1}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: peer ? 'var(--fg-main)' : 'var(--fg-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {peer ? peer.name : 'Empty'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Buddy Manager & Permissions */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--reggae-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} /> Connected Buddies ({roomState.peers.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {roomState.peers.length === 0 ? (
                  <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '16px' }}>
                    No buddies connected yet. Send them your room link!
                  </div>
                ) : (
                  roomState.peers.map((peer) => (
                    <div
                      key={peer.id}
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-muted)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--fg-bright)' }}>
                          {peer.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', display: 'flex', gap: '8px' }}>
                          <span>{peer.slot !== null ? `Player ${peer.slot + 1}` : 'Spectator'}</span>
                        </div>
                      </div>

                      {/* Permission Toggles */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => onUpdatePermissions(peer.id, { ...peer.permissions, gamepad: !peer.permissions.gamepad })}
                          className={`btn ${peer.permissions.gamepad ? 'btn-success' : 'btn-secondary'}`}
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          title={peer.permissions.gamepad ? 'Disable Gamepad' : 'Enable Gamepad'}
                        >
                          <Gamepad2 size={13} />
                        </button>

                        <button
                          onClick={() => onUpdatePermissions(peer.id, { ...peer.permissions, mouse: !peer.permissions.mouse, keyboard: !peer.permissions.keyboard })}
                          className={`btn ${peer.permissions.mouse ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          title={peer.permissions.mouse ? 'Disable Mouse & Keys' : 'Enable Mouse & Keys'}
                        >
                          <MousePointer size={13} />
                        </button>

                        <button
                          onClick={() => onKickPeer(peer.id)}
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          title="Kick Buddy"
                        >
                          <UserX size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Host Chat Box */}
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--fg-bright)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={14} color="var(--reggae-gold)" /> In-Session Chat
              </div>

              <div style={{ height: '110px', overflowY: 'auto', background: 'var(--bg-input)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ color: 'var(--fg-muted)', textAlign: 'center', marginTop: '35px' }}>No chat messages yet.</div>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id}>
                      <strong style={{ color: 'var(--reggae-gold)' }}>{msg.senderName}:</strong>{' '}
                      <span>{msg.text}</span>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Send message to room..."
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-muted)',
                    color: 'var(--fg-main)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '0.8rem'
                  }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 10px' }}>
                  <Send size={13} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
