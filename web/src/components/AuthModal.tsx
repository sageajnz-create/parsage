import React, { useState } from 'react';
import { UserProfile } from '../types';
import { LogIn, User, Sparkles, X, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onGoogleLogin: () => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  authError?: string | null;
}

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Sage&backgroundColor=1b1a17',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Shadow&backgroundColor=1b1a17',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber&backgroundColor=1b1a17',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nexus&backgroundColor=1b1a17',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Gamer1&backgroundColor=1b1a17',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Gamer2&backgroundColor=1b1a17'
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  profile,
  onGoogleLogin,
  onUpdateProfile,
  authError
}) => {
  const [name, setName] = useState(profile.name);
  const [tag, setTag] = useState(profile.tag);
  const [selectedAvatar, setSelectedAvatar] = useState(profile.avatarUrl);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name: name.trim() || 'Gamer',
      tag: tag.trim() || '1337',
      avatarUrl: selectedAvatar
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="card" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '32px',
        border: '2px solid var(--reggae-gold)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        position: 'relative',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.9)'
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '2.4rem' }}>🌿</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px' }} className="reggae-gradient-text">
            Parsage Gamer Profile
          </h3>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
            Sign in with Google or customize your local gaming identity.
          </p>
        </div>

        {authError && (
          <div style={{ background: 'rgba(232, 17, 45, 0.2)', border: '1px solid var(--reggae-red)', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--reggae-red-bright)', textAlign: 'center' }}>
            {authError}
          </div>
        )}

        {/* Free Google Sign-in Action */}
        <button
          onClick={onGoogleLogin}
          className="btn btn-primary"
          style={{ padding: '12px', fontSize: '0.95rem', display: 'flex', gap: '10px', justifyContent: 'center' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.7 0 3 .6 4 1.5l3-3C17.2 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
            <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
          </svg>
          <span>Continue with Google Account</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-muted)' }} />
          <span>OR CUSTOMIZE LOCAL PROFILE</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-muted)' }} />
        </div>

        {/* Local Gamer Profile Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Avatar Picker */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '8px' }}>
              Choose Avatar:
            </label>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {AVATAR_OPTIONS.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt="Avatar"
                  onClick={() => setSelectedAvatar(url)}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: selectedAvatar === url ? '3px solid var(--reggae-gold)' : '1px solid var(--border-muted)',
                    background: '#151412',
                    padding: '2px',
                    transition: 'transform 0.1s ease'
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Gamer Name:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px 12px', borderRadius: '8px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Tag:
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                maxLength={4}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--reggae-gold)', padding: '10px 12px', borderRadius: '8px', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-secondary" style={{ padding: '12px', marginTop: '6px' }}>
            Save & Close
          </button>
        </form>
      </div>
    </div>
  );
};
