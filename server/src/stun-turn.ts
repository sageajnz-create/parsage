export interface ParsageIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface ParsageRtcConfiguration {
  iceServers: ParsageIceServer[];
  iceCandidatePoolSize?: number;
  bundlePolicy?: 'max-bundle' | 'max-compat' | 'balanced';
  rtcpMuxPolicy?: 'require' | 'negotiate';
}

export const DEFAULT_ICE_SERVERS: ParsageIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com:3478' },
  { urls: 'stun:stun.nextcloud.com:443' }
];

export function getIceServers(env: NodeJS.ProcessEnv = process.env): ParsageIceServer[] {
  const turnUrls = env.TURN_URLS?.split(',').map(url => url.trim()).filter(Boolean) || [];
  if (turnUrls.length === 0) return DEFAULT_ICE_SERVERS;

  return [
    ...DEFAULT_ICE_SERVERS,
    {
      urls: turnUrls,
      username: env.TURN_USERNAME || '',
      credential: env.TURN_CREDENTIAL || ''
    }
  ];
}

export const RTC_CONFIGURATION: ParsageRtcConfiguration = {
  iceServers: getIceServers(),
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};
