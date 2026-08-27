import React, { useState } from 'react';
import { UserProfile } from '../types';
import { LogIn, User, Sparkles, X, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onGoogleLogin: () => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
}

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Sage&backgroundColor=1b1a17',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Alex&backgroundColor=1b1a17',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Marcus&backgroundColor=1b1a17',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Rasta&backgroundColor=1b1a17',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Gamer1&backgroundColor=1b1a17',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Gamer2&backgroundColor=1b1a17'
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  profile,
  onGoogleLogin,
  onUpdateProfile
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
            Sign in with Google (Free OAuth) or pick your local gamer identity.
          </p>
        </div>

        {/* Free Google Sign-in Action */}
        <button
          onClick={onGoogleLogin}
          className="btn btn-primary"
          style={{ padding: '12px', fontSize: '0.95rem', display: 'flex', gap: '10px' }}
        >
          <LogIn size={18} />
          <span>Continue with Google Account (Free)</span>
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
