import { RoomState, PeerInfo, ChatMessage, EmojiReaction, ClientInputPacket } from './types';

const GAMING_WORDS = [
  'OMEGA', 'TURBO', 'HYPER', 'VIPER', 'TITAN', 'VALOR', 'PHOENIX',
  'STEALTH', 'MATRIX', 'SHADOW', 'NEXUS', 'PULSE', 'FROST', 'CYBER',
  'DRIFT', 'STORM', 'BLAZE', 'APEX', 'VORTEX', 'COSMIC', 'QUANTUM'
];

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();
  private peerToRoom: Map<string, string> = new Map();

  public generateRoomCode(): string {
    const word = GAMING_WORDS[Math.floor(Math.random() * GAMING_WORDS.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `PARSAGE-${word}-${num}`;
  }

  public createRoom(
    hostId: string,
    hostName: string,
    settings?: Partial<RoomState['settings']>
  ): RoomState {
    const roomCode = this.generateRoomCode();
    const newRoom: RoomState = {
      roomCode,
      hostId,
      hostName,
      peers: [
        {
          id: hostId,
          name: hostName,
          role: 'host',
          slot: 0,
          approved: true,
          permissions: {
            gamepad: true,
            mouse: true,
            keyboard: true,
            audio: true
          },
          joinedAt: Date.now()
        }
      ],
      slots: [hostId, null, null, null],
      createdAt: Date.now(),
      settings: {
        maxBitrateMbps: 25,
        targetFps: 60,
        resolution: '1080p',
        requireApproval: false,
        allowMouseKeyboard: true,
        ...settings
      }
    };

    this.rooms.set(roomCode, newRoom);
    this.peerToRoom.set(hostId, roomCode);
    return newRoom;
  }

  public joinRoom(roomCode: string, peerId: string, peerName: string): { room: RoomState; peer: PeerInfo } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const existing = room.peers.find(p => p.id === peerId);
    if (existing) return { room, peer: existing };

    let autoSlot: number | null = null;
    for (let i = 0; i < 4; i++) {
      if (room.slots[i] === null) {
        autoSlot = i;
        break;
      }
    }

    const autoApprove = !room.settings.requireApproval;
    const newPeer: PeerInfo = {
      id: peerId,
      name: peerName,
      role: 'client',
      slot: autoApprove ? autoSlot : null,
      approved: autoApprove,
      permissions: {
        gamepad: true,
        mouse: false,
        keyboard: false,
        audio: true
      },
      joinedAt: Date.now()
    };

    if (autoApprove && autoSlot !== null) {
      room.slots[autoSlot] = peerId;
    }

    room.peers.push(newPeer);
    this.peerToRoom.set(peerId, roomCode);
    return { room, peer: newPeer };
  }

  public approvePeer(roomCode: string, peerId: string, approved: boolean, grantSlot: boolean = true): RoomState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const peer = room.peers.find(p => p.id === peerId);
    if (!peer) return null;

    peer.approved = approved;
    if (approved && grantSlot && peer.slot === null) {
      for (let i = 0; i < 4; i++) {
        if (room.slots[i] === null) {
          room.slots[i] = peerId;
          peer.slot = i;
          break;
        }
      }
    }
    return room;
  }

  public claimSlot(roomCode: string, peerId: string, requestedSlot: number | null): RoomState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const peer = room.peers.find(p => p.id === peerId);
    if (!peer || !peer.approved) return null;

    for (let i = 0; i < 4; i++) {
      if (room.slots[i] === peerId) {
        room.slots[i] = null;
      }
    }

    if (requestedSlot !== null && requestedSlot >= 0 && requestedSlot < 4) {
      if (room.slots[requestedSlot] === null) {
        room.slots[requestedSlot] = peerId;
        peer.slot = requestedSlot;
      } else {
        peer.slot = null;
      }
    } else {
      peer.slot = null;
    }

    return room;
  }

  public updatePermissions(
    roomCode: string,
    peerId: string,
    permissions: Partial<PeerInfo['permissions']>
  ): RoomState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const peer = room.peers.find(p => p.id === peerId);
    if (!peer) return null;

    peer.permissions = {
      ...peer.permissions,
      ...permissions
    };
    return room;
  }

  public removePeer(peerId: string): { roomCode: string; room: RoomState | null } | null {
    const roomCode = this.peerToRoom.get(peerId);
    if (!roomCode) return null;

    this.peerToRoom.delete(peerId);
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.peers = room.peers.filter(p => p.id !== peerId);
    for (let i = 0; i < 4; i++) {
      if (room.slots[i] === peerId) {
        room.slots[i] = null;
      }
    }

    if (room.hostId === peerId || room.peers.length === 0) {
      this.rooms.delete(roomCode);
      return { roomCode, room: null };
    }

    return { roomCode, room };
  }

  public getRoomByPeer(peerId: string): RoomState | null {
    const code = this.peerToRoom.get(peerId);
    return code ? this.rooms.get(code) || null : null;
  }

  public getRoom(roomCode: string): RoomState | null {
    return this.rooms.get(roomCode) || null;
  }
}
