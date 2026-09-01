export type PeerRole = 'host' | 'client' | 'agent';

export interface PeerInfo {
  id: string;
  name: string;
  role: PeerRole;
  slot: number | null; // 0 (P1), 1 (P2), 2 (P3), 3 (P4) or null (Spectator)
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
  slots: (string | null)[]; // 4 slots: [peerId, peerId, peerId, peerId]
  createdAt: number;
  settings: {
    maxBitrateMbps: number;
    targetFps: number;
    resolution: string;
    requireApproval: boolean;
    allowMouseKeyboard: boolean;
  };
}

export interface GamepadPacket {
  slot: number;
  buttons: number;
  axes: number[];
  timestamp: number;
}

export interface MouseEventPacket {
  type: 'move' | 'down' | 'up' | 'wheel';
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  button?: number;
  deltaY?: number;
}

export interface KeyboardEventPacket {
  type: 'down' | 'up';
  key: string;
  code: string;
  keycode?: number;
}

export type ParsageMessage =
  | { type: 'create-room'; name: string; settings?: Partial<RoomState['settings']> }
  | { type: 'join-room'; roomCode: string; name: string; role?: PeerRole }
  | { type: 'room-created'; roomCode: string; hostId: string; state: RoomState }
  | { type: 'room-joined'; roomCode: string; peerId: string; state: RoomState }
  | { type: 'room-state'; state: RoomState }
  | { type: 'peer-approved'; hostId: string; state: RoomState }
  | { type: 'peer-joined'; peer: PeerInfo }
  | { type: 'peer-left'; peerId: string }
  | { type: 'approve-peer'; peerId: string; slot?: number | null }
  | { type: 'claim-slot'; slot: number }
  | { type: 'release-slot'; slot: number }
  | { type: 'update-permissions'; peerId: string; permissions: PeerInfo['permissions'] }
  | { type: 'kick-peer'; peerId: string }
  | { type: 'chat'; message: string }
  | { type: 'new-chat'; chat: ChatMessage }
  | { type: 'reaction'; emoji: string }
  | { type: 'new-reaction'; reaction: EmojiReaction }
  | { type: 'offer'; targetPeerId: string; sdp: any }
  | { type: 'answer'; targetPeerId: string; sdp: any }
  | { type: 'ice-candidate'; targetPeerId: string; candidate: any }
  | { type: 'native-media-start'; targetPeerId: string }
  | { type: 'media-capabilities'; targetPeerId: string; codecs: string[] }
  | { type: 'resume-session'; token: string }
  | { type: 'session-ready'; token: string }
  | { type: 'session-resumed'; peerId: string; state: RoomState | null; isHost: boolean }
  | { type: 'session-resume-failed' }
  | { type: 'ping'; timestamp: number }
  | { type: 'pong'; timestamp: number; serverTime: number }
  | { type: 'error'; message: string };
