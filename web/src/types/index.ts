export type MainView = 'computers' | 'arcade' | 'friends' | 'settings' | 'diagnostics' | 'streaming';

export type TabView = MainView;

export type SettingsTab = 'client' | 'host' | 'gamepad' | 'network' | 'account';

export type PeerRole = 'host' | 'client' | 'agent';

export interface UserProfile {
  id: string;
  name: string;
  tag: string;
  email?: string;
  avatarUrl: string;
  isGoogleAuth: boolean;
  status: 'online' | 'in-game' | 'hosting' | 'idle';
  currentGame?: string;
}

export interface SavedComputer {
  id: string;
  name: string;
  ownerName: string;
  roomCode: string;
  status: 'online' | 'offline' | 'hosting';
  gpu: string;
  pingMs: number;
  lastSeen: number;
}

export interface ArcadeSession {
  id: string;
  roomCode: string;
  gameTitle: string;
  gameBannerUrl?: string;
  hostName: string;
  hostAvatar: string;
  currentPlayers: number;
  maxPlayers: number;
  pingMs: number;
  resolution: string;
  fps: number;
}

export interface Friend {
  id: string;
  name: string;
  tag: string;
  avatarUrl: string;
  status: 'online' | 'in-game' | 'hosting' | 'offline';
  currentGame?: string;
  roomCode?: string;
}

export interface PeerInfo {
  id: string;
  name: string;
  role: PeerRole;
  slot: number | null; // 0: P1, 1: P2, 2: P3, 3: P4
  approved: boolean;
  permissions: {
    gamepad: boolean;
    mouse: boolean;
    keyboard: boolean;
    audio: boolean;
  };
  pingMs?: number;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  slot: number | null;
  text: string;
  timestamp: number;
}

export interface EmojiReaction {
  id: string;
  senderId: string;
  senderName: string;
  emoji: string;
  timestamp: number;
}

export interface RoomState {
  roomCode: string;
  hostId: string | null;
  hostName: string;
  peers: PeerInfo[];
  slots: (string | null)[];
  createdAt: number;
  settings: {
    maxBitrateMbps: number;
    targetFps: number;
    resolution: string;
    requireApproval: boolean;
    allowMouseKeyboard: boolean;
    gameTitle?: string;
  };
}

export interface StreamStats {
  fps: number;
  bitrateMbps: number;
  rttMs: number;
  jitterMs: number;
  packetsLost: number;
  resolution: string;
  codec: string;
  decodeMs: number;
  captureMs?: number | null;
  encodeMs?: number | null;
  networkMs?: number | null;
  presentMs?: number | null;
  dominantStage?: string | null;
}

export interface GamepadState {
  index: number;
  id: string;
  connected: boolean;
  buttons: boolean[];
  buttonValues: number[];
  axes: number[];
  timestamp: number;
}

export interface ParsageSettings {
  client: {
    renderer: 'webgpu' | 'webgl2' | 'auto';
    codec: 'h264' | 'hevc' | 'av1' | 'auto';
    windowMode: 'borderless' | 'windowed' | 'fullscreen';
    vsync: boolean;
    overlayHotkey: string;
    fullscreenHotkey: string;
    hudHotkey: string;
    chromaFormat: '4:2:0' | '4:4:4';
  };
  host: {
    enabled: boolean;
    resolution: 'match' | '720p' | '1080p' | 'ultrawide' | '1440p' | '4K';
    fps: 30 | 60 | 120 | 144 | 240;
    maxBitrateMbps: number;
    adaptiveBitrate: boolean;
    requireApproval: boolean;
    allowMouseKeyboard: boolean;
    audioSink: string;
    virtualGamepadType: 'xbox360' | 'dualshock4';
  };
  gamepad: {
    deadzone: number;
    rumble: boolean;
    swapButtons: boolean;
    invertY: boolean;
  };
  network: {
    lanDiscovery: boolean;
    congestionControl: 'gcc' | 'bbr' | 'constant';
    customStunServer: string;
  };
}
