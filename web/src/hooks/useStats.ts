import { useState, useEffect, useRef } from 'react';
import { StreamStats } from '../types';
import { dominantLatencyStage, latencyStagesFromReport } from '../media/bitrateAdaptation';

const EMPTY_STATS: StreamStats = {
  fps: 0,
  bitrateMbps: 0,
  rttMs: 0,
  jitterMs: 0,
  packetsLost: 0,
  resolution: '—',
  codec: 'H.264',
  decodeMs: 0,
  captureMs: null,
  encodeMs: null,
  networkMs: null,
  presentMs: null,
  dominantStage: null
};

export function useStats(
  stream: MediaStream | null,
  peerConnection?: RTCPeerConnection | null,
  nativeLatency?: { captureMs?: number | null; encodeMs?: number | null; codec?: string }
) {
  const [stats, setStats] = useState<StreamStats>(EMPTY_STATS);
  const lastBytesRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!stream) {
      setStats(EMPTY_STATS);
      return;
    }

    const interval = setInterval(async () => {
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings() || {};
      const width = settings.width || 0;
      const height = settings.height || 0;
      const fps = Math.round(settings.frameRate || 0);
      let next: StreamStats = {
        ...EMPTY_STATS,
        fps,
        resolution: width && height ? `${width}x${height}` : '—',
        captureMs: nativeLatency?.captureMs ?? null,
        encodeMs: nativeLatency?.encodeMs ?? null,
        codec: nativeLatency?.codec ? String(nativeLatency.codec).toUpperCase() : 'H.264'
      };

      if (peerConnection) {
        try {
          const report = await peerConnection.getStats();
          const records: Array<Record<string, unknown>> = [];
          report.forEach((stat) => records.push(stat as unknown as Record<string, unknown>));
          const stages = latencyStagesFromReport(records);
          records.forEach((stat) => {
            if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
              const now = Date.now();
              const timeDiff = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0;
              const bytes = Number(stat.bytesReceived) || 0;
              const bytesDiff = bytes - lastBytesRef.current;
              if (timeDiff > 0 && bytesDiff >= 0) {
                next.bitrateMbps = Number(((bytesDiff * 8) / (timeDiff * 1_000_000)).toFixed(2));
              }
              next.jitterMs = Number((((Number(stat.jitter) || 0) * 1000)).toFixed(1));
              next.packetsLost = Number(stat.packetsLost) || 0;
              lastBytesRef.current = bytes;
              lastTimeRef.current = now;
              const mime = String(stat.mimeType || stat.codecId || '');
              if (mime.toLowerCase().includes('265') || mime.toLowerCase().includes('hevc')) next.codec = 'HEVC';
              else if (mime.toLowerCase().includes('av1')) next.codec = 'AV1';
              else if (mime.toLowerCase().includes('264')) next.codec = 'H.264';
            }
            if (stat.type === 'codec' && typeof stat.mimeType === 'string') {
              const mime = stat.mimeType.toLowerCase();
              if (mime.includes('h264')) next.codec = 'H.264';
              if (mime.includes('h265') || mime.includes('hevc')) next.codec = 'HEVC';
              if (mime.includes('av1')) next.codec = 'AV1';
            }
            if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
              next.rttMs = Math.round((Number(stat.currentRoundTripTime) || 0) * 1000);
            }
          });
          next = {
            ...next,
            captureMs: nativeLatency?.captureMs ?? stages.captureMs ?? next.captureMs,
            encodeMs: nativeLatency?.encodeMs ?? stages.encodeMs ?? next.encodeMs,
            networkMs: stages.networkMs ?? next.networkMs,
            decodeMs: stages.decodeMs ?? next.decodeMs,
            presentMs: stages.presentMs ?? next.presentMs
          };
        } catch (_error) {}
      }

      next.dominantStage = dominantLatencyStage({
        captureMs: next.captureMs,
        encodeMs: next.encodeMs,
        networkMs: next.networkMs,
        decodeMs: next.decodeMs,
        presentMs: next.presentMs
      });
      setStats(next);
    }, 1000);

    return () => clearInterval(interval);
  }, [stream, peerConnection, nativeLatency?.captureMs, nativeLatency?.encodeMs, nativeLatency?.codec]);

  return stats;
}
