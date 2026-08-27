import React, { useState } from 'react';
import { SettingsTab, ParsageSettings, UserProfile } from '../types';
import {
  Monitor, Radio, Gamepad2, Wifi, User, RotateCcw,
  Check, Sliders, Shield, Zap, Sparkles, LogIn, LogOut, Key
} from 'lucide-react';

interface SettingsViewProps {
  settings: ParsageSettings;
  profile: UserProfile;
  googleClientId?: string;
  onUpdateGoogleClientId?: (id: string) => void;
  onUpdateClient: <K extends keyof ParsageSettings['client']>(key: K, val: ParsageSettings['client'][K]) => void;
  onUpdateHost: <K extends keyof ParsageSettings['host']>(key: K, val: ParsageSettings['host'][K]) => void;
  onUpdateGamepad: <K extends keyof ParsageSettings['gamepad']>(key: K, val: ParsageSettings['gamepad'][K]) => void;
  onUpdateNetwork: <K extends keyof ParsageSettings['network']>(key: K, val: ParsageSettings['network'][K]) => void;
  onResetDefaults: () => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onOpenGoogleAuth: () => void;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  profile,
  googleClientId,
  onUpdateGoogleClientId,
  onUpdateClient,
  onUpdateHost,
  onUpdateGamepad,
  onUpdateNetwork,
  onResetDefaults,
  onUpdateProfile,
  onOpenGoogleAuth,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('client');
  const [nameInput, setNameInput] = useState(profile.name);
  const [tagInput, setTagInput] = useState(profile.tag);
  const [clientIdInput, setClientIdInput] = useState(googleClientId || '');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({ name: nameInput, tag: tagInput });
    if (onUpdateGoogleClientId && clientIdInput !== googleClientId) {
      onUpdateGoogleClientId(clientIdInput);
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Parsage Settings</h2>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.88rem', marginTop: '2px' }}>
            Configure video decoding, Linux host hardware encoders, controllers, and network options.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={onResetDefaults} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          <RotateCcw size={15} />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Settings Tab Navigation */}
      <div className="card" style={{ padding: '6px', display: 'flex', gap: '6px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('client')}
          className={`btn ${activeTab === 'client' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '9px', fontSize: '0.88rem', border: 'none' }}
        >
          <Monitor size={16} />
          <span>Client</span>
        </button>

        <button
          onClick={() => setActiveTab('host')}
          className={`btn ${activeTab === 'host' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '9px', fontSize: '0.88rem', border: 'none' }}
        >
          <Radio size={16} />
          <span>Host (Linux)</span>
        </button>

        <button
          onClick={() => setActiveTab('gamepad')}
          className={`btn ${activeTab === 'gamepad' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '9px', fontSize: '0.88rem', border: 'none' }}
        >
          <Gamepad2 size={16} />
          <span>Gamepad</span>
        </button>

        <button
          onClick={() => setActiveTab('network')}
          className={`btn ${activeTab === 'network' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '9px', fontSize: '0.88rem', border: 'none' }}
        >
          <Wifi size={16} />
          <span>Network & LAN</span>
        </button>

        <button
          onClick={() => setActiveTab('account')}
          className={`btn ${activeTab === 'account' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '9px', fontSize: '0.88rem', border: 'none' }}
        >
          <User size={16} />
          <span>Account & Auth</span>
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* 1. CLIENT SETTINGS */}
      {activeTab === 'client' && (
        <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', color: 'var(--reggae-gold)', fontWeight: 800 }}>Client Stream & Display Preferences</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Video Renderer:
              </label>
              <select
                value={settings.client.renderer}
                onChange={(e) => onUpdateClient('renderer', e.target.value as any)}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px', borderRadius: '8px' }}
              >
                <option value="auto">Auto (Lowest Latency)</option>
                <option value="webgpu">WebGPU / Vulkan Acceleration</option>
                <option value="webgl2">WebGL 2.0 Canvas</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Preferred Video Codec:
              </label>
              <select
                value={settings.client.codec}
                onChange={(e) => onUpdateClient('codec', e.target.value as any)}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px', borderRadius: '8px' }}
              >
                <option value="auto">Auto Select</option>
                <option value="h264">H.264 (Broadest Support / Fast)</option>
                <option value="hevc">HEVC / H.265 (High Efficiency)</option>
                <option value="av1">AV1 (Next-Gen Quality)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Window Playout Mode:
              </label>
              <select
                value={settings.client.windowMode}
                onChange={(e) => onUpdateClient('windowMode', e.target.value as any)}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px', borderRadius: '8px' }}
              >
                <option value="borderless">Borderless Fullscreen</option>
                <option value="windowed">Windowed Canvas</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Chroma Subsampling:
              </label>
              <select
                value={settings.client.chromaFormat}
                onChange={(e) => onUpdateClient('chromaFormat', e.target.value as any)}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px', borderRadius: '8px' }}
              >
                <option value="4:2:0">4:2:0 (Standard Low Bandwidth)</option>
                <option value="4:4:4">4:4:4 (Crisp Text / Desktop Work)</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={settings.client.vsync}
                onChange={(e) => onUpdateClient('vsync', e.target.checked)}
                style={{ accentColor: 'var(--reggae-gold)', width: '16px', height: '16px' }}
              />
              <span><strong>V-Sync:</strong> Disable for ultra-low latency sub-frame rendering</span>
            </label>
          </div>
        </div>
      )}

      {/* 2. HOST SETTINGS */}
      {activeTab === 'host' && (
        <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', color: 'var(--reggae-green-bright)', fontWeight: 800 }}>Linux Host (Omarchy / Wayland) Options</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Default Resolution:
              </label>
              <select
                value={settings.host.resolution}
                onChange={(e) => onUpdateHost('resolution', e.target.value as any)}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px', borderRadius: '8px' }}
              >
                <option value="match">Match Client Display</option>
                <option value="720p">720p (Fast)</option>
                <option value="1080p">1080p (Standard Full HD)</option>
                <option value="ultrawide">1080p Ultrawide (2560x1080)</option>
                <option value="1440p">1440p (2K)</option>
                <option value="4K">4K (2160p)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Target Framerate:
              </label>
              <select
                value={settings.host.fps}
                onChange={(e) => onUpdateHost('fps', parseInt(e.target.value) as any)}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px', borderRadius: '8px' }}
              >
                <option value={60}>60 FPS (Silky Smooth)</option>
                <option value={120}>120 FPS (Ultra Low Latency)</option>
                <option value={144}>144 FPS (Esports)</option>
                <option value={240}>240 FPS (Pro Competitive)</option>
                <option value={30}>30 FPS (Low Bandwidth)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Virtual Controller Type:
              </label>
              <select
                value={settings.host.virtualGamepadType}
                onChange={(e) => onUpdateHost('virtualGamepadType', e.target.value as any)}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px', borderRadius: '8px' }}
              >
                <option value="xbox360">Microsoft Xbox 360 (Highest Compatibility)</option>
                <option value="dualshock4">Sony DualShock 4 (PS4 / PS5)</option>
              </select>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
              <span>Bandwidth Limit:</span>
              <span style={{ color: 'var(--reggae-gold)', fontWeight: 'bold' }}>{settings.host.maxBitrateMbps} Mbps</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={settings.host.maxBitrateMbps}
              onChange={(e) => onUpdateHost('maxBitrateMbps', parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--reggae-gold)' }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={settings.host.adaptiveBitrate}
                onChange={(e) => onUpdateHost('adaptiveBitrate', e.target.checked)}
                style={{ accentColor: 'var(--reggae-green)', width: '16px', height: '16px' }}
              />
              <span><strong>Adaptive Bitrate (GCC):</strong> Automatically scales bandwidth on network congestion</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={settings.host.requireApproval}
                onChange={(e) => onUpdateHost('requireApproval', e.target.checked)}
                style={{ accentColor: 'var(--reggae-gold)', width: '16px', height: '16px' }}
              />
              <span><strong>Require Host Approval:</strong> Manually approve incoming buddies before granting access</span>
            </label>
          </div>
        </div>
      )}

      {/* 3. GAMEPAD SETTINGS */}
      {activeTab === 'gamepad' && (
        <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', color: 'var(--zion-teal-bright)', fontWeight: 800 }}>Gamepad & Controller Calibration</h3>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
              <span>Stick Deadzone:</span>
              <span style={{ color: 'var(--zion-teal-bright)', fontWeight: 'bold' }}>{(settings.gamepad.deadzone * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.30}
              step={0.01}
              value={settings.gamepad.deadzone}
              onChange={(e) => onUpdateGamepad('deadzone', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--zion-teal-bright)' }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={settings.gamepad.rumble}
                onChange={(e) => onUpdateGamepad('rumble', e.target.checked)}
                style={{ accentColor: 'var(--reggae-gold)', width: '16px', height: '16px' }}
              />
              <span><strong>Haptic Force Feedback:</strong> Forward host game vibration to client controllers</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={settings.gamepad.swapButtons}
                onChange={(e) => onUpdateGamepad('swapButtons', e.target.checked)}
                style={{ accentColor: 'var(--reggae-gold)', width: '16px', height: '16px' }}
              />
              <span><strong>Swap A/B & X/Y:</strong> Use Nintendo Switch Pro layout</span>
            </label>
          </div>
        </div>
      )}

      {/* 4. NETWORK SETTINGS */}
      {activeTab === 'network' && (
        <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', color: 'var(--reggae-gold)', fontWeight: 800 }}>Network & Direct P2P Settings</h3>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
              Custom STUN Server (Optional):
            </label>
            <input
              type="text"
              value={settings.network.customStunServer}
              onChange={(e) => onUpdateNetwork('customStunServer', e.target.value)}
              placeholder="stun:your-server.com:3478"
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px 14px', borderRadius: '8px' }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={settings.network.lanDiscovery}
                onChange={(e) => onUpdateNetwork('lanDiscovery', e.target.checked)}
                style={{ accentColor: 'var(--reggae-green)', width: '16px', height: '16px' }}
              />
              <span><strong>LAN Direct Connect:</strong> Automatically discover local home network peers for 0ms internet latency</span>
            </label>
          </div>
        </div>
      )}

      {/* 5. ACCOUNT & GOOGLE AUTH */}
      {activeTab === 'account' && (
        <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--fg-bright)', fontWeight: 800 }}>Gamer Profile & Sign-In</h3>
              <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
                Sign in with Google OAuth or customize your local Parsage gamer tag.
              </p>
            </div>

            {profile.isGoogleAuth ? (
              <button className="btn btn-danger" onClick={onLogout} style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
                <LogOut size={15} />
                <span>Log Out ({profile.name})</span>
              </button>
            ) : (
              <button className="btn btn-primary" onClick={onOpenGoogleAuth} style={{ padding: '10px 18px', display: 'flex', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.7 0 3 .6 4 1.5l3-3C17.2 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                  <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}
          </div>

          <form onSubmit={handleProfileSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Gamer Display Name:
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px 14px', borderRadius: '8px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Gamer Tag (4 digits):
              </label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                maxLength={4}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--reggae-gold)', padding: '10px 14px', borderRadius: '8px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
                Google OAuth Client ID (Optional / Custom Domain):
              </label>
              <input
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="your-client-id.apps.googleusercontent.com"
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--fg-main)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
              {savedNotice && <span style={{ color: 'var(--reggae-green-bright)', fontSize: '0.85rem' }}>✓ Profile & Client ID saved!</span>}
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>
                Save Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
