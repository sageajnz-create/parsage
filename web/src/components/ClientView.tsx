import React, { useState, useEffect, useRef } from 'react';
import { RoomState, ChatMessage, EmojiReaction } from '../types';
import { useGamepad } from '../hooks/useGamepad';
import { useStats } from '../hooks/useStats';
import { StatsOverlay } from './StatsOverlay';
import { OverlayMenu } from './OverlayMenu';
import { Users, Play, Maximize, Volume2, VolumeX, Gamepad2, Wifi, MessageSquare } from 'lucide-react';

interface ClientViewProps {
  roomState: RoomState | null;
  remoteStream: MediaStream | null;
  assignedSlot: number | null;
  chatMessages: ChatMessage[];
  reactions: EmojiReaction[];
  onJoinRoom: (roomCode: string, name: string) => void;
  onClaimSlot: (slot: number) => void;
  onSendInput: (packet: any) => void;
  onSendChat: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  wsConnected: boolean;
  errorMsg: string | null;
}

export const ClientView: React.FC<ClientViewProps> = ({
  roomState,
  remoteStream,
  assignedSlot,
  chatMessages,
  reactions,
  onJoinRoom,
  onClaimSlot,
  onSendInput,
  onSendChat,
  onSendReaction,
  wsConnected,
  errorMsg
}) => {
  const [roomCode, setRoomCode] = useState('');
  const [guestName, setGuestName] = useState('Buddy');
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1.0);
  const [showHud, setShowHud] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { gamepads, activeGamepadIndex, packGamepadState } = useGamepad();
  const activePad = gamepads.find(g => g.index === activeGamepadIndex) || gamepads[0];

  const stats = useStats(remoteStream);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      setRoomCode(joinCode.toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
      videoRef.current.play().catch(e => console.log('Autoplay deferred:', e));
    }
  }, [remoteStream, volume, muted]);

  // 120Hz Real-Time Gamepad Dispatch Loop
  useEffect(() => {
    if (!roomState || assignedSlot === null || !activePad) return;

    let animId: number;
    let lastSentTime = 0;

    const loop = () => {
      const now = performance.now();
      if (now - lastSentTime >= 8) {
        const packet = packGamepadState(activePad, assignedSlot);
        onSendInput(packet);
        lastSentTime = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [roomState, assignedSlot, activePad, packGamepadState, onSendInput]);

  // Mouse & Keyboard Event Forwarding
  const handleMouseMove = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!document.pointerLockElement) return;
    onSendInput({
      type: 'mouse',
      action: 'move',
      dx: e.movementX,
      dy: e.movementY
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!document.pointerLockElement) {
      videoRef.current?.requestPointerLock?.();
      return;
    }
    onSendInput({
      type: 'mouse',
      action: 'down',
      button: e.button
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!document.pointerLockElement) return;
    onSendInput({
      type: 'mouse',
      action: 'up',
      button: e.button
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLVideoElement>) => {
    if (!document.pointerLockElement) return;
    onSendInput({
      type: 'mouse',
      action: 'wheel',
      deltaY: e.deltaY
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    onJoinRoom(roomCode.trim(), guestName.trim() || 'Buddy');
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const handleLeaveRoom = () => {
    window.location.href = window.location.origin;
  };

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {!roomState ? (
        /* Join Room View */
        <div className="card" style={{ maxWidth: '550px', margin: '40px auto', padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '2.5rem' }}>🎮</span>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px' }} className="reggae-gradient-text">
              Join Parsage Session
            </h2>
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
              Enter room code or connect directly on your local network.
            </p>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(232, 17, 45, 0.15)', border: '1px solid var(--reggae-red)', color: 'var(--reggae-red-bright)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Room Code (e.g. PARSAGE-R4STA-7K9M2QXP):
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="PARSAGE-WORD-ROOMCODE"
                required
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-accent)',
                  color: 'var(--reggae-gold-bright)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '1.1rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 'bold',
                  letterSpacing: '0.05em'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Your Player Name:
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Buddy"
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

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!wsConnected || !roomCode}
              style={{ padding: '14px', marginTop: '10px' }}
            >
              <Play size={20} />
              <span>Connect & Play</span>
            </button>
          </form>
        </div>
      ) : (
        /* Connected Full Viewport Player */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Bar */}
          <div className="card" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="badge badge-green">
                <span>HOST: {roomState.hostName}</span>
              </div>
              <div className="badge badge-reggae">
                <span>ROOM: {roomState.roomCode}</span>
              </div>
              {assignedSlot !== null ? (
                <div className={`badge slot-p${assignedSlot + 1}`} style={{ border: '1px solid' }}>
                  <Gamepad2 size={13} />
                  <span>PLAYER {assignedSlot + 1}</span>
                </div>
              ) : (
                <div className="badge badge-teal">
                  <span>SPECTATOR</span>
                </div>
              )}
            </div>

            {/* Slot Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Slot:</span>
              {[0, 1, 2, 3].map((slotIdx) => (
                <button
                  key={slotIdx}
                  onClick={() => onClaimSlot(slotIdx)}
                  className={`btn ${assignedSlot === slotIdx ? 'btn-success' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  P{slotIdx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Fullscreen Video Canvas */}
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              background: '#0B0A09',
              borderRadius: '12px',
              overflow: 'hidden',
              aspectRatio: '16/9',
              border: '1px solid var(--border-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7)'
            }}
          >
            {remoteStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={muted}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'crosshair' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <Wifi size={48} color="var(--reggae-gold)" className="pulse-dot" style={{ margin: '0 auto 16px auto', width: '32px', height: '32px' }} />
                <h3 style={{ fontSize: '1.2rem', color: 'var(--fg-bright)' }}>Connecting to Host...</h3>
                <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                  WebRTC P2P direct channel is negotiating with {roomState.hostName}.
                </p>
              </div>
            )}

            {/* Parsec-style Floating In-Stream Overlay Menu */}
            <OverlayMenu
              assignedSlot={assignedSlot}
              muted={muted}
              volume={volume}
              showHud={showHud}
              chatMessages={chatMessages}
              onToggleMute={() => setMuted(!muted)}
              onChangeVolume={setVolume}
              onToggleHud={() => setShowHud(!showHud)}
              onToggleFullscreen={toggleFullscreen}
              onClaimSlot={onClaimSlot}
              onSendReaction={onSendReaction}
              onSendChat={onSendChat}
              onLeaveRoom={handleLeaveRoom}
            />

            {/* Floating Animated Party Emoji Bursts */}
            <div style={{ position: 'absolute', bottom: '60px', right: '30px', pointerEvents: 'none', display: 'flex', flexDirection: 'column-reverse', gap: '8px', zIndex: 40 }}>
              {reactions.map((rx) => (
                <div
                  key={rx.id}
                  style={{
                    background: 'rgba(27, 26, 23, 0.85)',
                    border: '1px solid var(--reggae-gold)',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '1.3rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    animation: 'pulse 0.4s ease'
                  }}
                >
                  <span>{rx.emoji}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-main)' }}>{rx.senderName}</span>
                </div>
              ))}
            </div>

            {/* Performance HUD Overlay */}
            {showHud && <StatsOverlay stats={stats} />}
          </div>
        </div>
      )}
    </div>
  );
};
