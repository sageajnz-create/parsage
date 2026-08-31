import { WebSocket } from 'ws';
import { randomInt } from 'node:crypto';
import { PeerInfo, RoomState, ParsageMessage, PeerRole, ChatMessage, EmojiReaction } from './types.js';

export interface ConnectedClient {
  id: string;
  name: string;
  ws: WebSocket;
  roomCode: string | null;
  role: PeerRole;
  slot: number | null;
  approved: boolean;
  authUserId: string | null;
  permissions: {
    gamepad: boolean;
    mouse: boolean;
    keyboard: boolean;
    audio: boolean;
  };
  joinedAt: number;
}

const REGGAE_WORDS = [
  'R4STA', 'ZION', 'ROOTS', 'IRIE', 'SAGE', 'CHEEZ', 'DUB', 'VIBE',
  'LION', 'JAM', 'GROOVE', 'SOLAR', 'CHILL', 'BEAT', 'SKANK', 'MELODY'
];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();
  private clients: Map<string, ConnectedClient> = new Map();
  private approvedIdentities: Map<string, Set<string>> = new Map();

  public generateRoomCode(): string {
    const word = REGGAE_WORDS[randomInt(REGGAE_WORDS.length)];
    let suffix = '';
    for (let i = 0; i < 8; i++) suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    const code = `PARSAGE-${word}-${suffix}`;
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }

  public registerClient(id: string, ws: WebSocket, name: string = 'Anonymous', authUserId: string | null = null): ConnectedClient {
    const client: ConnectedClient = {
      id,
      name,
      ws,
      roomCode: null,
      role: 'client',
      slot: null,
      approved: true,
      authUserId,
      permissions: {
        gamepad: true,
        mouse: false,
        keyboard: false,
        audio: true
      },
      joinedAt: Date.now()
    };
    this.clients.set(id, client);
    return client;
  }

  public getClient(id: string): ConnectedClient | undefined {
    return this.clients.get(id);
  }

  public reconnectClient(id: string, ws: WebSocket, authUserId: string | null): ConnectedClient | null {
    const client = this.clients.get(id);
    if (!client || client.authUserId !== authUserId) return null;
    client.ws = ws;
    return client;
  }

  public canExchangeRtc(senderId: string, targetId: string): boolean {
    const sender = this.clients.get(senderId);
    const target = this.clients.get(targetId);
    if (!sender || !target || !sender.roomCode || sender.roomCode !== target.roomCode) return false;
    const room = this.rooms.get(sender.roomCode);
    if (!room) return false;
    if (sender.id === room.hostId) return target.approved;
    return sender.approved && target.id === room.hostId;
  }

  public removeClient(id: string): { roomCode: string | null; wasHost: boolean } {
    const client = this.clients.get(id);
    if (!client) return { roomCode: null, wasHost: false };

    const roomCode = client.roomCode;
    let wasHost = false;

    if (roomCode && this.rooms.has(roomCode)) {
      const room = this.rooms.get(roomCode)!;
      if (room.hostId === id) {
        wasHost = true;
        this.broadcastToRoom(roomCode, {
          type: 'error',
          message: 'Host has ended the streaming session.'
        }, id);
        this.rooms.delete(roomCode);
        this.approvedIdentities.delete(roomCode);
      } else {
        if (client.slot !== null && room.slots[client.slot] === id) {
          room.slots[client.slot] = null;
        }
        room.peers = room.peers.filter(p => p.id !== id);
        this.broadcastToRoom(roomCode, { type: 'peer-left', peerId: id });
        this.broadcastRoomState(roomCode);
      }
    }

    this.clients.delete(id);
    return { roomCode, wasHost };
  }

  public createRoom(
    hostId: string,
    hostName: string,
    settings?: Partial<RoomState['settings']>
  ): { roomCode: string; state: RoomState } {
    const client = this.clients.get(hostId);
    if (!client) throw new Error('Host client not registered');

    const roomCode = this.generateRoomCode();
    client.roomCode = roomCode;
    client.role = 'host';
    client.name = hostName;
    client.approved = true;
    client.permissions = { gamepad: true, mouse: true, keyboard: true, audio: true };

    const state: RoomState = {
      roomCode,
      hostId,
      hostName,
      peers: [],
      slots: [null, null, null, null],
      createdAt: Date.now(),
      settings: {
        maxBitrateMbps: settings?.maxBitrateMbps ?? 20,
        targetFps: settings?.targetFps ?? 60,
        resolution: settings?.resolution ?? '1080p',
        requireApproval: settings?.requireApproval ?? true,
        allowMouseKeyboard: settings?.allowMouseKeyboard ?? true
      }
    };

    this.rooms.set(roomCode, state);
    this.approvedIdentities.set(roomCode, new Set());
    return { roomCode, state };
  }

  public joinRoom(
    peerId: string,
    roomCode: string,
    peerName: string,
    role: PeerRole = 'client'
  ): { success: boolean; state?: RoomState; error?: string } {
    const client = this.clients.get(peerId);
    if (!client) return { success: false, error: 'Client not found' };

    const room = this.rooms.get(roomCode.trim().toUpperCase());
    if (!room) return { success: false, error: `Room "${roomCode}" does not exist or has expired.` };

    const safeRole: PeerRole = role === 'agent' ? 'agent' : 'client';
    client.roomCode = room.roomCode;
    client.name = peerName;
    client.role = safeRole;
    const identityWasApproved = client.authUserId
      ? this.approvedIdentities.get(room.roomCode)?.has(client.authUserId) === true
      : false;
    client.approved = !room.settings.requireApproval || identityWasApproved;
    client.joinedAt = Date.now();

    let assignedSlot: number | null = null;
    if (safeRole === 'client' && client.approved) {
      const freeSlotIndex = room.slots.findIndex(s => s === null);
      if (freeSlotIndex !== -1) {
        room.slots[freeSlotIndex] = peerId;
        assignedSlot = freeSlotIndex;
      }
    }
    client.slot = assignedSlot;

    const peerInfo: PeerInfo = {
      id: client.id,
      name: client.name,
      role: client.role,
      slot: client.slot,
      approved: client.approved,
      permissions: client.permissions,
      joinedAt: client.joinedAt
    };

    room.peers = room.peers.filter(p => p.id !== peerId);
    room.peers.push(peerInfo);

    this.broadcastToRoom(room.roomCode, { type: 'peer-joined', peer: peerInfo }, peerId);
    this.broadcastRoomState(room.roomCode);

    return { success: true, state: room };
  }

  public approvePeer(hostId: string, targetPeerId: string, slot?: number | null): boolean {
    const host = this.clients.get(hostId);
    if (!host || !host.roomCode) return false;

    const room = this.rooms.get(host.roomCode);
    if (!room || room.hostId !== hostId) return false;

    const target = this.clients.get(targetPeerId);
    if (!target || target.roomCode !== room.roomCode || !room.peers.some(peer => peer.id === targetPeerId)) {
      return false;
    }

    target.approved = true;
    if (target.authUserId) {
      this.approvedIdentities.get(room.roomCode)?.add(target.authUserId);
    }

    if (slot !== undefined && slot !== null && slot >= 0 && slot <= 3) {
      if (room.slots[slot] === null) {
        room.slots[slot] = targetPeerId;
        target.slot = slot;
      }
    } else if (target.slot === null) {
      const freeSlot = room.slots.findIndex(s => s === null);
      if (freeSlot !== -1) {
        room.slots[freeSlot] = targetPeerId;
        target.slot = freeSlot;
      }
    }

    const peer = room.peers.find(p => p.id === targetPeerId);
    if (peer) {
      peer.approved = true;
      peer.slot = target.slot;
    }

    this.broadcastRoomState(room.roomCode);
    this.sendToPeer(targetPeerId, { type: 'peer-approved', hostId, state: room });
    return true;
  }

  public claimSlot(peerId: string, slot: number): boolean {
    const client = this.clients.get(peerId);
    if (!client || !client.roomCode || !client.approved || slot < 0 || slot > 3) return false;

    const room = this.rooms.get(client.roomCode);
    if (!room) return false;

    if (room.slots[slot] !== null && room.slots[slot] !== peerId) {
      return false;
    }

    if (client.slot !== null && client.slot !== slot) {
      room.slots[client.slot] = null;
    }

    room.slots[slot] = peerId;
    client.slot = slot;

    const peer = room.peers.find(p => p.id === peerId);
    if (peer) peer.slot = slot;

    this.broadcastRoomState(room.roomCode);
    return true;
  }

  public releaseSlot(peerId: string, slot: number): boolean {
    const client = this.clients.get(peerId);
    if (!client || !client.roomCode) return false;

    const room = this.rooms.get(client.roomCode);
    if (!room) return false;

    if (room.slots[slot] === peerId) {
      room.slots[slot] = null;
      client.slot = null;
      const peer = room.peers.find(p => p.id === peerId);
      if (peer) peer.slot = null;
      this.broadcastRoomState(room.roomCode);
      return true;
    }
    return false;
  }

  public updatePermissions(
    hostId: string,
    targetPeerId: string,
    permissions: PeerInfo['permissions']
  ): boolean {
    const host = this.clients.get(hostId);
    if (!host || !host.roomCode) return false;

    const room = this.rooms.get(host.roomCode);
    if (!room || room.hostId !== hostId) return false;

    const target = this.clients.get(targetPeerId);
    if (!target || target.roomCode !== room.roomCode || !room.peers.some(peer => peer.id === targetPeerId)) {
      return false;
    }

    target.permissions = { ...permissions };
    const peer = room.peers.find(p => p.id === targetPeerId);
    if (peer) peer.permissions = { ...permissions };

    this.broadcastRoomState(room.roomCode);
    return true;
  }

  public kickPeer(hostId: string, targetPeerId: string): boolean {
    const host = this.clients.get(hostId);
    if (!host || !host.roomCode) return false;

    const room = this.rooms.get(host.roomCode);
    if (!room || room.hostId !== hostId) return false;

    const target = this.clients.get(targetPeerId);
    if (target && target.roomCode === room.roomCode && room.peers.some(peer => peer.id === targetPeerId)) {
      if (target.authUserId) this.approvedIdentities.get(room.roomCode)?.delete(target.authUserId);
      this.sendToPeer(targetPeerId, { type: 'error', message: 'You have been disconnected by the host.' });
      target.ws.close(1000, 'Kicked by host');
      this.removeClient(targetPeerId);
      return true;
    }
    return false;
  }

  public broadcastChat(peerId: string, text: string): void {
    const client = this.clients.get(peerId);
    if (!client || !client.roomCode) return;

    const chatMsg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId: peerId,
      senderName: client.name,
      slot: client.slot,
      text,
      timestamp: Date.now()
    };

    this.broadcastToRoom(client.roomCode, { type: 'new-chat', chat: chatMsg });
  }

  public broadcastReaction(peerId: string, emoji: string): void {
    const client = this.clients.get(peerId);
    if (!client || !client.roomCode) return;

    const reaction: EmojiReaction = {
      id: `rx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId: peerId,
      senderName: client.name,
      emoji,
      timestamp: Date.now()
    };

    this.broadcastToRoom(client.roomCode, { type: 'new-reaction', reaction });
  }

  public getRoom(roomCode: string): RoomState | undefined {
    return this.rooms.get(roomCode.trim().toUpperCase());
  }

  public expirePending(now = Date.now(), timeoutMs = 60_000): string[] {
    const expired: string[] = [];
    for (const client of this.clients.values()) {
      if (client.roomCode && client.role !== 'host' && !client.approved && now - client.joinedAt >= timeoutMs) {
        expired.push(client.id);
      }
    }
    for (const id of expired) {
      const client = this.clients.get(id);
      this.sendToPeer(id, { type: 'error', message: 'The host approval request expired.' });
      client?.ws.close(4008, 'Approval expired');
      this.removeClient(id);
    }
    return expired;
  }

  public expireRooms(now = Date.now(), maxAgeMs = 12 * 60 * 60_000): string[] {
    const expired: string[] = [];
    for (const room of this.rooms.values()) {
      if (now - room.createdAt >= maxAgeMs) expired.push(room.roomCode);
    }
    for (const roomCode of expired) {
      const room = this.rooms.get(roomCode);
      if (!room) continue;
      this.broadcastToRoom(roomCode, { type: 'error', message: 'This room expired.' });
      const participantIds = [room.hostId, ...room.peers.map(peer => peer.id)].filter(Boolean) as string[];
      for (const id of participantIds) this.clients.get(id)?.ws.close(4009, 'Room expired');
      this.rooms.delete(roomCode);
      this.approvedIdentities.delete(roomCode);
      for (const id of participantIds) this.clients.delete(id);
    }
    return expired;
  }

  public broadcastToRoom(roomCode: string, message: ParsageMessage, excludePeerId?: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const raw = JSON.stringify(message);

    if (room.hostId && room.hostId !== excludePeerId) {
      const hostClient = this.clients.get(room.hostId);
      if (hostClient && hostClient.ws.readyState === WebSocket.OPEN) {
        hostClient.ws.send(raw);
      }
    }

    for (const peer of room.peers) {
      if (peer.id !== excludePeerId) {
        const client = this.clients.get(peer.id);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(raw);
        }
      }
    }
  }

  public broadcastRoomState(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      this.broadcastToRoom(roomCode, { type: 'room-state', state: room });
    }
  }

  public sendToPeer(peerId: string, message: ParsageMessage): boolean {
    const client = this.clients.get(peerId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
}
