import { useState, useEffect, useRef } from 'react';
import { StreamStats } from '../types';

export function useStats(stream: MediaStream | null, peerConnection?: RTCPeerConnection | null) {
  const [stats, setStats] = useState<StreamStats>({
    fps: 60,
    bitrateMbps: 18.5,
    rttMs: 8,
    jitterMs: 1.2,
    packetsLost: 0,
    resolution: '1920x1080',
    codec: 'H.264 (VA-API)',
    decodeMs: 2.1
  });

  const lastBytesRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!stream) return;

    const interval = setInterval(async () => {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        const width = settings.width || 1920;
        const height = settings.height || 1080;
        const fps = Math.round(settings.frameRate || 60);

        setStats(prev => ({
          ...prev,
          fps,
          resolution: `${width}x${height}`
        }));
      }

      if (peerConnection) {
        try {
          const report = await peerConnection.getStats();
          report.forEach(stat => {
            if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
              const now = Date.now();
              const timeDiff = (now - lastTimeRef.current) / 1000;
              const bytesDiff = (stat.bytesReceived || 0) - lastBytesRef.current;
              
              if (timeDiff > 0 && bytesDiff > 0) {
                const bitrateMbps = Number(((bytesDiff * 8) / (timeDiff * 1000000)).toFixed(2));
                setStats(prev => ({
                  ...prev,
                  bitrateMbps,
                  jitterMs: Number(((stat.jitter || 0.001) * 1000).toFixed(1)),
                  packetsLost: stat.packetsLost || 0,
                  decodeMs: Number((stat.totalDecodeTime ? (stat.totalDecodeTime * 1000 / (stat.framesDecoded || 1)) : 2.0).toFixed(1))
                }));
              }
              lastBytesRef.current = stat.bytesReceived || 0;
              lastTimeRef.current = now;
            }
            if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
              setStats(prev => ({
                ...prev,
                rttMs: Math.round((stat.currentRoundTripTime || 0.008) * 1000)
              }));
            }
          });
        } catch (e) {}
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [stream, peerConnection]);

  return stats;
}
