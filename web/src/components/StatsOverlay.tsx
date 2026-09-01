import React, { useState } from 'react';
import { StreamStats } from '../types';
import { Activity, Zap, Cpu, Wifi, Eye, EyeOff } from 'lucide-react';

interface StatsOverlayProps {
  stats: StreamStats;
}

function formatMs(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)} ms`;
}

function stageLabel(stage?: string | null) {
  if (!stage) return '—';
  const labels: Record<string, string> = {
    captureMs: 'capture',
    encodeMs: 'encode',
    networkMs: 'network',
    decodeMs: 'decode',
    presentMs: 'present'
  };
  return labels[stage] || stage.replace(/Ms$/, '');
}

export const StatsOverlay: React.FC<StatsOverlayProps> = ({ stats }) => {
  const [collapsed, setCollapsed] = useState(false);

  const getPingColor = (rtt: number) => {
    if (rtt < 15) return 'var(--reggae-green-bright)';
    if (rtt < 40) return 'var(--reggae-gold)';
    return 'var(--reggae-red-bright)';
  };

  const getFpsColor = (fps: number) => {
    if (fps >= 58) return 'var(--reggae-green-bright)';
    if (fps >= 45) return 'var(--reggae-gold)';
    return 'var(--reggae-red-bright)';
  };

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      right: '16px',
      zIndex: 40,
      background: 'rgba(27, 26, 23, 0.85)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--border-muted)',
      borderRadius: '10px',
      padding: collapsed ? '6px 10px' : '10px 14px',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.6)',
      fontSize: '0.78rem',
      fontFamily: 'var(--font-mono)',
      color: 'var(--fg-main)',
      transition: 'all 0.2s ease',
      userSelect: 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: collapsed ? 0 : '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
          <Activity size={14} color="var(--reggae-gold)" />
          <span style={{ color: 'var(--reggae-gold)' }}>PARSAGE HUD</span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex' }}
          title={collapsed ? 'Expand HUD' : 'Collapse HUD'}
        >
          {collapsed ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      {collapsed ? (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: getFpsColor(stats.fps), fontWeight: 'bold' }}>{stats.fps} FPS</span>
          <span style={{ color: getPingColor(stats.rttMs) }}>{stats.rttMs} ms</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '6px 16px', borderTop: '1px solid rgba(74, 69, 54, 0.5)', paddingTop: '8px' }}>
          <div style={{ color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={12} /> FPS:
          </div>
          <div style={{ textAlign: 'right', color: getFpsColor(stats.fps), fontWeight: 'bold' }}>
            {stats.fps}
          </div>

          <div style={{ color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Wifi size={12} /> Latency (RTT):
          </div>
          <div style={{ textAlign: 'right', color: getPingColor(stats.rttMs), fontWeight: 'bold' }}>
            {stats.rttMs} ms
          </div>

          <div style={{ color: 'var(--fg-muted)' }}>Bitrate:</div>
          <div style={{ textAlign: 'right', color: 'var(--zion-teal-bright)' }}>
            {stats.bitrateMbps} Mbps
          </div>

          <div style={{ color: 'var(--fg-muted)' }}>Resolution:</div>
          <div style={{ textAlign: 'right' }}>
            {stats.resolution}
          </div>

          <div style={{ color: 'var(--fg-muted)' }}>Codec:</div>
          <div style={{ textAlign: 'right', color: 'var(--reggae-gold)' }}>
            {stats.codec}
          </div>

          <div style={{ color: 'var(--fg-muted)' }}>Capture:</div>
          <div style={{ textAlign: 'right' }}>{formatMs(stats.captureMs)}</div>

          <div style={{ color: 'var(--fg-muted)' }}>Encode:</div>
          <div style={{ textAlign: 'right' }}>{formatMs(stats.encodeMs)}</div>

          <div style={{ color: 'var(--fg-muted)' }}>Network:</div>
          <div style={{ textAlign: 'right' }}>{formatMs(stats.networkMs)}</div>

          <div style={{ color: 'var(--fg-muted)' }}>Decode:</div>
          <div style={{ textAlign: 'right' }}>
            {formatMs(stats.decodeMs)}
          </div>

          <div style={{ color: 'var(--fg-muted)' }}>Present:</div>
          <div style={{ textAlign: 'right' }}>{formatMs(stats.presentMs)}</div>

          <div style={{ color: 'var(--fg-muted)' }}>Slowest stage:</div>
          <div style={{ textAlign: 'right', color: 'var(--reggae-gold)' }}>
            {stageLabel(stats.dominantStage)}
          </div>

          <div style={{ color: 'var(--fg-muted)' }}>Jitter:</div>
          <div style={{ textAlign: 'right' }}>
            {stats.jitterMs} ms
          </div>
        </div>
      )}
    </div>
  );
};
