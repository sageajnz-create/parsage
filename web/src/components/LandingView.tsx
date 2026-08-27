import React from 'react';
import { Download, Play, ShieldCheck, Zap, Monitor, Gamepad2, Users, Cpu, ArrowRight } from 'lucide-react';

interface LandingViewProps {
  onLaunchApp: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onLaunchApp }) => {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '48px', paddingBottom: '40px' }}>
      {/* Hero Section */}
      <div className="card" style={{
        padding: '60px 40px',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #272520 0%, #1B1A17 100%)',
        border: '2px solid var(--border-muted)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }} className="badge badge-reggae">
          <ShieldCheck size={14} />
          <span>Created with ❤️ by Sage & Antigravity</span>
        </div>

        <h1 style={{
          fontSize: '3.2rem',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          marginBottom: '16px'
        }}>
          Play Local Co-op with Friends.<br />
          <span className="reggae-gradient-text">Hosted Natively on Linux.</span>
        </h1>

        <p style={{
          fontSize: '1.2rem',
          color: 'var(--fg-muted)',
          maxWidth: '750px',
          margin: '0 auto 32px auto',
          lineHeight: 1.6
        }}>
          Parsage is the high-performance, plug-and-play game streaming suite built for Omarchy, Wayland, and Linux Mint. Zero port forwarding, hardware VA-API/NVENC encoding, and virtual 4-player Xbox 360 controller emulation.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={onLaunchApp}
            style={{ padding: '14px 28px', fontSize: '1.1rem' }}
          >
            <Play size={20} />
            <span>Launch Web App (Zero Install)</span>
          </button>

          <a
            href="/dist_pkg/parsage_0.1.0_all.deb"
            download="parsage_0.1.0_all.deb"
            className="btn btn-success"
            style={{ padding: '14px 28px', fontSize: '1.1rem' }}
          >
            <Download size={20} />
            <span>Download Linux Mint / Ubuntu (.deb)</span>
          </a>
        </div>
      </div>

      {/* Feature Pillars (3 Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(30, 181, 58, 0.15)', border: '1px solid var(--reggae-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={26} color="var(--reggae-green-bright)" />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--fg-bright)' }}>
            Sub-4ms Hardware VA-API
          </h3>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Direct zero-copy PipeWire screen capture with AMD Radeon (Navi 23) and NVIDIA NVENC hardware compression for esports-ready 120 FPS and 240 FPS streaming.
          </p>
        </div>

        <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255, 199, 44, 0.15)', border: '1px solid var(--reggae-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Gamepad2 size={26} color="var(--reggae-gold)" />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--fg-bright)' }}>
            4-Player Virtual Xbox Joysticks
          </h3>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Linux kernel <code>/dev/uinput</code> driver provisions 4 genuine Xbox 360 controllers with force feedback rumble. Smash, Castle Crashers, and Steam co-op work out of the box.
          </p>
        </div>

        <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(79, 191, 168, 0.15)', border: '1px solid var(--zion-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={26} color="var(--zion-teal-bright)" />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--fg-bright)' }}>
            Zero Port-Forwarding P2P
          </h3>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Send a room link to friends on Windows, Mac, or Linux. WebRTC STUN hole-punching creates direct UDP channels without touching router settings.
          </p>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="card" style={{ padding: '36px' }}>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '24px', textAlign: 'center' }}>
          Parsage vs Standard Remote Apps on Linux
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-muted)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', color: 'var(--fg-muted)' }}>FEATURE</th>
                <th style={{ padding: '12px 16px', color: 'var(--reggae-gold)' }}>🌿 PARSAGE</th>
                <th style={{ padding: '12px 16px', color: 'var(--fg-muted)' }}>PARSEC (WINDOWS ONLY HOST)</th>
                <th style={{ padding: '12px 16px', color: 'var(--fg-muted)' }}>SUNSHINE / MOONLIGHT</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <td style={{ padding: '14px 16px', fontWeight: 'bold' }}>Linux Wayland Host</td>
                <td style={{ padding: '14px 16px', color: 'var(--reggae-green-bright)', fontWeight: 'bold' }}>✅ Native (PipeWire)</td>
                <td style={{ padding: '14px 16px', color: 'var(--reggae-red-bright)' }}>❌ No Linux Host</td>
                <td style={{ padding: '14px 16px' }}>⚠️ Complex Setup</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <td style={{ padding: '14px 16px', fontWeight: 'bold' }}>Zero Router Port-Forwarding</td>
                <td style={{ padding: '14px 16px', color: 'var(--reggae-green-bright)', fontWeight: 'bold' }}>✅ WebRTC STUN P2P</td>
                <td style={{ padding: '14px 16px' }}>✅ Proprietary NAT</td>
                <td style={{ padding: '14px 16px', color: 'var(--reggae-red-bright)' }}>❌ Manual Ports Needed</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <td style={{ padding: '14px 16px', fontWeight: 'bold' }}>Zero-Install Web Client</td>
                <td style={{ padding: '14px 16px', color: 'var(--reggae-green-bright)', fontWeight: 'bold' }}>✅ 1-Click Link</td>
                <td style={{ padding: '14px 16px' }}>✅ Web App</td>
                <td style={{ padding: '14px 16px', color: 'var(--reggae-red-bright)' }}>❌ App Install Required</td>
              </tr>
              <tr>
                <td style={{ padding: '14px 16px', fontWeight: 'bold' }}>Multi-Gamepad Kernel Injection</td>
                <td style={{ padding: '14px 16px', color: 'var(--reggae-green-bright)', fontWeight: 'bold' }}>✅ 4x Xbox 360 (/dev/uinput)</td>
                <td style={{ padding: '14px 16px' }}>⚠️ Windows ViGEm only</td>
                <td style={{ padding: '14px 16px' }}>⚠️ Virtual uinput</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
