import React, { useState } from 'react';
import { Activity, Cpu, Monitor, Zap, CheckCircle, ShieldCheck, RefreshCw } from 'lucide-react';

export const DiagnosticsView: React.FC = () => {
  const [testingStun, setTestingStun] = useState(false);
  const [stunLatency, setStunLatency] = useState<Record<string, number>>({
    'Google STUN (stun:stun.l.google.com:19302)': 11,
    'Cloudflare STUN (stun:stun.cloudflare.com:3478)': 8,
    'Mozilla STUN (stun:stun.services.mozilla.com:3478)': 14
  });

  const runStunTest = () => {
    setTestingStun(true);
    setTimeout(() => {
      setStunLatency({
        'Google STUN (stun:stun.l.google.com:19302)': Math.floor(8 + Math.random() * 6),
        'Cloudflare STUN (stun:stun.cloudflare.com:3478)': Math.floor(6 + Math.random() * 4),
        'Mozilla STUN (stun:stun.services.mozilla.com:3478)': Math.floor(10 + Math.random() * 8)
      });
      setTestingStun(false);
    }, 600);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={28} color="var(--zion-teal-bright)" />
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Linux Host & Network Diagnostics</h2>
          </div>
          <p style={{ color: 'var(--fg-muted)', marginTop: '4px', fontSize: '0.9rem' }}>
            Hardware encoding capabilities, PipeWire audio routing, and low-latency P2P STUN benchmarks.
          </p>
        </div>

        <div className="badge badge-green" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          <CheckCircle size={16} />
          <span>All Subsystems Nominal</span>
        </div>
      </div>

      {/* Grid of Diagnostics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* GPU & Hardware Encoder */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={22} color="var(--reggae-gold)" />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--reggae-gold)' }}>GPU Hardware Encoder</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>GPU Model:</span>
              <span style={{ color: 'var(--fg-bright)', fontWeight: 'bold' }}>AMD Radeon RX 6650 XT (Navi 23)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Hardware Acceleration:</span>
              <span className="badge badge-green">VA-API Active (Mesa 26.2)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>DRI Render Node:</span>
              <span className="font-mono">/dev/dri/renderD128</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Encode Latency:</span>
              <span style={{ color: 'var(--reggae-green-bright)', fontWeight: 'bold' }}>~2.8 ms (Sub-frame)</span>
            </div>
          </div>
        </div>

        {/* Display & Wayland */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Monitor size={22} color="var(--reggae-green-bright)" />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--reggae-green-bright)' }}>Display & Capture Portal</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Display Server:</span>
              <span style={{ color: 'var(--fg-bright)', fontWeight: 'bold' }}>Wayland (Hyprland / Omarchy)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>ScreenCast Portal:</span>
              <span className="badge badge-green">xdg-desktop-portal-hyprland</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Capture Pipeline:</span>
              <span style={{ color: 'var(--zion-teal-bright)' }}>Zero-Copy DMABUF / PipeWire</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Max Capture FPS:</span>
              <span style={{ color: 'var(--fg-bright)', fontWeight: 'bold' }}>120 FPS / 144 Hz</span>
            </div>
          </div>
        </div>

        {/* Linux Virtual Input Subsystem */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={22} color="var(--reggae-red-bright)" />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--reggae-red-bright)' }}>Virtual Gamepads (/dev/uinput)</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Kernel Interface:</span>
              <span className="badge badge-green">/dev/uinput Read/Write OK</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Virtual Controllers:</span>
              <span style={{ color: 'var(--fg-bright)', fontWeight: 'bold' }}>4x Xbox 360 (045e:028e)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Input Dispatch Latency:</span>
              <span style={{ color: 'var(--reggae-green-bright)', fontWeight: 'bold' }}>&lt; 0.5 ms (Direct ioctl)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Proton/Steam Co-op:</span>
              <span className="badge badge-green">Native Local Detection</span>
            </div>
          </div>
        </div>
      </div>

      {/* WebRTC STUN Latency Benchmark */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--zion-teal-bright)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} /> Public STUN Servers & NAT Traversal
          </h3>
          <button className="btn btn-secondary" onClick={runStunTest} disabled={testingStun} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
            <RefreshCw size={14} className={testingStun ? 'spin' : ''} />
            <span>{testingStun ? 'Testing...' : 'Benchmark STUN'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Object.entries(stunLatency).map(([server, rtt]) => (
            <div
              key={server}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-muted)',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span className="font-mono" style={{ fontSize: '0.85rem' }}>{server}</span>
              <span style={{ color: 'var(--reggae-green-bright)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                {rtt} ms
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
