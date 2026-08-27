import React, { useState } from 'react';
import { ChatMessage, EmojiReaction } from '../types';
import {
  Volume2, VolumeX, Maximize, Activity, MessageSquare,
  Smile, Gamepad2, LogOut, ChevronDown, ChevronUp, Send,
  MousePointer, Lock
} from 'lucide-react';

interface OverlayMenuProps {
  assignedSlot: number | null;
  muted: boolean;
  volume: number;
  showHud: boolean;
  chatMessages: ChatMessage[];
  onToggleMute: () => void;
  onChangeVolume: (vol: number) => void;
  onToggleHud: () => void;
  onToggleFullscreen: () => void;
  onClaimSlot: (slot: number) => void;
  onSendReaction: (emoji: string) => void;
  onSendChat: (text: string) => void;
  onLeaveRoom: () => void;
}

const EMOJIS = ['🔥', '🎮', '🌿', '😂', '👑', '👏', '⚡', '💯'];

export const OverlayMenu: React.FC<OverlayMenuProps> = ({
  assignedSlot,
  muted,
  volume,
  showHud,
  chatMessages,
  onToggleMute,
  onChangeVolume,
  onToggleHud,
  onToggleFullscreen,
  onClaimSlot,
  onSendReaction,
  onSendChat,
  onLeaveRoom
}) => {
  const [open, setOpen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  return (
    <>
      {/* Floating Pill Trigger at Top Center */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: 'rgba(27, 26, 23, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--reggae-gold)',
            color: 'var(--fg-main)',
            padding: '6px 14px',
            borderRadius: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            transition: 'all 0.15s ease'
          }}
        >
          <span>🌿 PARSAGE MENU</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Expanded Overlay Toolbar */}
        {open && (
          <div style={{
            marginTop: '8px',
            background: 'rgba(27, 26, 23, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-muted)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            minWidth: '380px'
          }}>
            {/* Slot Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Controller Slot:</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2, 3].map((slot) => (
                  <button
                    key={slot}
                    onClick={() => onClaimSlot(slot)}
                    className={`btn ${assignedSlot === slot ? 'btn-success' : 'btn-secondary'}`}
                    style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                  >
                    P{slot + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <button
                onClick={onToggleMute}
                className={`btn ${muted ? 'btn-danger' : 'btn-secondary'}`}
                style={{ padding: '6px 10px', fontSize: '0.8rem', flex: 1 }}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span>{muted ? 'Muted' : 'Audio'}</span>
              </button>

              <button
                onClick={onToggleHud}
                className={`btn ${showHud ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 10px', fontSize: '0.8rem', flex: 1 }}
                title="Toggle Performance HUD (F8)"
              >
                <Activity size={15} />
                <span>HUD</span>
              </button>

              <button
                onClick={onToggleFullscreen}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.8rem', flex: 1 }}
                title="Toggle Fullscreen"
              >
                <Maximize size={15} />
                <span>Full</span>
              </button>

              <button
                onClick={() => setShowChat(!showChat)}
                className={`btn ${showChat ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 10px', fontSize: '0.8rem', flex: 1 }}
                title="In-game Chat"
              >
                <MessageSquare size={15} />
                <span>Chat</span>
              </button>
            </div>

            {/* Emoji Reactions Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-input)', padding: '6px 10px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Smile size={13} /> React:
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onSendReaction(emoji)}
                    style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', transform: 'scale(1)', transition: 'transform 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Leave Session */}
            <button
              onClick={onLeaveRoom}
              className="btn btn-danger"
              style={{ padding: '8px', fontSize: '0.8rem' }}
            >
              <LogOut size={15} />
              <span>Leave Streaming Session</span>
            </button>
          </div>
        )}
      </div>

      {/* In-Game Chat Drawer (Bottom Left) */}
      {showChat && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          width: '320px',
          height: '240px',
          zIndex: 45,
          background: 'rgba(27, 26, 23, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-muted)',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-muted)', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            <span>In-Game Chat</span>
            <button onClick={() => setShowChat(false)} style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
            {chatMessages.length === 0 ? (
              <div style={{ color: 'var(--fg-muted)', textAlign: 'center', marginTop: '40px' }}>No messages yet. Say hi!</div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} style={{ wordBreak: 'break-word' }}>
                  <strong style={{ color: msg.slot !== null ? `var(--slot-p${msg.slot + 1})` : 'var(--reggae-gold)' }}>
                    {msg.senderName}:
                  </strong>{' '}
                  <span style={{ color: 'var(--fg-main)' }}>{msg.text}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleChatSubmit} style={{ padding: '8px', borderTop: '1px solid var(--border-muted)', display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Press Enter to send..."
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
      )}
    </>
  );
};
