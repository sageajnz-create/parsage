import { createHash, randomBytes } from 'node:crypto';
import {
  DurableStore,
  PresenceStatus,
  StoredDevice,
  StoredIdentity,
  StoredPresence,
  StoredQuickLink
} from './store.js';

export interface PublicIdentity {
  id: string;
  kind: 'google' | 'local';
  name: string;
  tag: string;
  email?: string;
  avatarUrl: string;
  handle: string;
}

export interface FriendRecord extends PublicIdentity {
  status: PresenceStatus;
  roomCode?: string | null;
  currentGame?: string;
}

const LOCAL_SESSION_MS = 365 * 24 * 60 * 60_000;
const GOOGLE_SESSION_MS = 7 * 24 * 60 * 60_000;
const DEFAULT_LINK_TTL_MS = 24 * 60 * 60_000;
const MAX_LINK_TTL_MS = 7 * 24 * 60 * 60_000;

function handleOf(identity: StoredIdentity): string {
  return `${identity.name}#${identity.tag}`;
}

function publicIdentity(identity: StoredIdentity): PublicIdentity {
  return {
    id: identity.id,
    kind: identity.kind,
    name: identity.name,
    tag: identity.tag,
    email: identity.email,
    avatarUrl: identity.avatarUrl,
    handle: handleOf(identity)
  };
}

function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export class AccountRegistry {
  constructor(
    private readonly store: DurableStore,
    private readonly now: () => number = () => Date.now()
  ) {}

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  upsertGoogleIdentity(input: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
  }): StoredIdentity {
    let saved: StoredIdentity | undefined;
    this.store.mutate(data => {
      const existing = data.identities[input.id];
      const tag = existing?.tag || this.allocateTag(data, input.name, input.id.slice(-4));
      saved = {
        id: input.id,
        kind: 'google',
        name: input.name.slice(0, 64),
        tag,
        email: input.email,
        avatarUrl: input.avatarUrl || '',
        createdAt: existing?.createdAt || this.now(),
        updatedAt: this.now()
      };
      data.identities[input.id] = saved;
    });
    return saved!;
  }

  createLocalIdentity(input: { name: string; tag?: string; avatarUrl?: string }): { token: string; identity: StoredIdentity } {
    const token = randomBytes(32).toString('base64url');
    const id = `local-${randomBytes(12).toString('hex')}`;
    let saved: StoredIdentity | undefined;
    this.store.mutate(data => {
      const name = input.name.trim().slice(0, 64) || 'Gamer';
      const tag = this.allocateTag(data, name, input.tag);
      saved = {
        id,
        kind: 'local',
        name,
        tag,
        avatarUrl: input.avatarUrl || '',
        createdAt: this.now(),
        updatedAt: this.now()
      };
      data.identities[id] = saved;
      data.sessions[this.hashToken(token)] = {
        tokenHash: this.hashToken(token),
        identityId: id,
        kind: 'local',
        expiresAt: this.now() + LOCAL_SESSION_MS
      };
    });
    return { token, identity: saved! };
  }

  putGoogleSession(token: string, identityId: string): void {
    this.store.mutate(data => {
      data.sessions[this.hashToken(token)] = {
        tokenHash: this.hashToken(token),
        identityId,
        kind: 'google',
        expiresAt: this.now() + GOOGLE_SESSION_MS
      };
    });
  }

  identityFromTokenHash(tokenHash: string): StoredIdentity | null {
    const data = this.store.snapshot();
    const session = data.sessions[tokenHash];
    if (!session) return null;
    if (session.expiresAt <= this.now()) {
      this.store.mutate(current => { delete current.sessions[tokenHash]; });
      return null;
    }
    return data.identities[session.identityId] || null;
  }

  deleteSession(tokenHash: string): void {
    this.store.mutate(data => { delete data.sessions[tokenHash]; });
  }

  getIdentity(id: string): StoredIdentity | null {
    return this.store.snapshot().identities[id] || null;
  }

  updateIdentity(id: string, input: { name?: string; tag?: string; avatarUrl?: string }): StoredIdentity | null {
    let saved: StoredIdentity | null = null;
    this.store.mutate(data => {
      const existing = data.identities[id];
      if (!existing) return;
      const name = (input.name ?? existing.name).trim().slice(0, 64) || existing.name;
      const tag = input.tag ? this.allocateTag(data, name, input.tag, id) : existing.tag;
      saved = {
        ...existing,
        name,
        tag,
        avatarUrl: input.avatarUrl ?? existing.avatarUrl,
        updatedAt: this.now()
      };
      data.identities[id] = saved;
    });
    return saved;
  }

  toPublic(identity: StoredIdentity): PublicIdentity {
    return publicIdentity(identity);
  }

  findByHandle(handle: string): StoredIdentity | null {
    const normalized = handle.trim().replace(/\s+/g, '');
    const match = normalized.match(/^(.+)#([A-Za-z0-9]{2,8})$/);
    if (!match) return null;
    const name = match[1];
    const tag = match[2].toUpperCase();
    const data = this.store.snapshot();
    return Object.values(data.identities).find(
      identity => identity.name.toLowerCase() === name.toLowerCase() && identity.tag.toUpperCase() === tag
    ) || null;
  }

  addFriend(actorId: string, handle: string): FriendRecord {
    const friend = this.findByHandle(handle);
    if (!friend) throw new Error('No Parsage identity matches that name#tag.');
    if (friend.id === actorId) throw new Error('You cannot add yourself as a friend.');
    const [a, b] = pairKey(actorId, friend.id);
    this.store.mutate(data => {
      if (data.friendships.some(item => item.a === a && item.b === b)) return;
      data.friendships.push({
        id: randomBytes(8).toString('hex'),
        a,
        b,
        createdAt: this.now()
      });
    });
    return this.decorateFriend(friend);
  }

  removeFriend(actorId: string, friendId: string): void {
    const [a, b] = pairKey(actorId, friendId);
    this.store.mutate(data => {
      data.friendships = data.friendships.filter(item => !(item.a === a && item.b === b));
    });
  }

  listFriends(actorId: string): FriendRecord[] {
    const data = this.store.snapshot();
    return data.friendships
      .filter(item => item.a === actorId || item.b === actorId)
      .map(item => item.a === actorId ? item.b : item.a)
      .map(id => data.identities[id])
      .filter(Boolean)
      .map(identity => this.decorateFriend(identity, data.presence[identity.id]));
  }

  registerDevice(ownerId: string, input: { name: string; platform?: string; gpu?: string }): StoredDevice {
    const id = randomBytes(12).toString('hex');
    let saved: StoredDevice | undefined;
    this.store.mutate(data => {
      saved = {
        id,
        ownerId,
        name: input.name.trim().slice(0, 80) || 'Parsage Host',
        platform: (input.platform || process.platform).slice(0, 32),
        gpu: input.gpu?.slice(0, 80),
        lastSeen: this.now(),
        roomCode: null
      };
      data.devices[id] = saved;
    });
    return saved!;
  }

  listDevices(ownerId: string): StoredDevice[] {
    return Object.values(this.store.snapshot().devices).filter(device => device.ownerId === ownerId);
  }

  removeDevice(ownerId: string, deviceId: string): boolean {
    let removed = false;
    this.store.mutate(data => {
      const device = data.devices[deviceId];
      if (!device || device.ownerId !== ownerId) return;
      delete data.devices[deviceId];
      removed = true;
    });
    return removed;
  }

  touchDevice(ownerId: string, roomCode: string | null): void {
    this.store.mutate(data => {
      for (const device of Object.values(data.devices)) {
        if (device.ownerId !== ownerId) continue;
        device.lastSeen = this.now();
        device.roomCode = roomCode;
      }
    });
  }

  setPresence(identityId: string, status: PresenceStatus, extras: { roomCode?: string | null; currentGame?: string } = {}): void {
    this.store.mutate(data => {
      data.presence[identityId] = {
        identityId,
        status,
        roomCode: extras.roomCode ?? null,
        currentGame: extras.currentGame,
        updatedAt: this.now()
      };
    });
  }

  getPresence(identityId: string): StoredPresence | null {
    return this.store.snapshot().presence[identityId] || null;
  }

  createQuickLink(ownerId: string, roomCode: string, expiresInMs = DEFAULT_LINK_TTL_MS): { token: string; link: StoredQuickLink } {
    const ttl = Math.min(Math.max(expiresInMs, 60_000), MAX_LINK_TTL_MS);
    const token = randomBytes(24).toString('base64url');
    const tokenHash = this.hashToken(token);
    let saved: StoredQuickLink | undefined;
    this.store.mutate(data => {
      saved = {
        tokenHash,
        roomCode: roomCode.trim().toUpperCase(),
        ownerId,
        createdAt: this.now(),
        expiresAt: this.now() + ttl,
        revokedAt: null
      };
      data.quickLinks[tokenHash] = saved;
    });
    return { token, link: saved! };
  }

  resolveQuickLink(token: string): StoredQuickLink | null {
    const tokenHash = this.hashToken(token);
    const link = this.store.snapshot().quickLinks[tokenHash];
    if (!link) return null;
    if (link.revokedAt || link.expiresAt <= this.now()) return null;
    return link;
  }

  revokeQuickLink(ownerId: string, token: string): boolean {
    const tokenHash = this.hashToken(token);
    let revoked = false;
    this.store.mutate(data => {
      const link = data.quickLinks[tokenHash];
      if (!link || link.ownerId !== ownerId) return;
      link.revokedAt = this.now();
      revoked = true;
    });
    return revoked;
  }

  listQuickLinks(ownerId: string): StoredQuickLink[] {
    return Object.values(this.store.snapshot().quickLinks)
      .filter(link => link.ownerId === ownerId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  counts(): { identities: number; devices: number; friendships: number; quickLinks: number } {
    const data = this.store.snapshot();
    return {
      identities: Object.keys(data.identities).length,
      devices: Object.keys(data.devices).length,
      friendships: data.friendships.length,
      quickLinks: Object.keys(data.quickLinks).length
    };
  }

  private decorateFriend(identity: StoredIdentity, presence?: StoredPresence): FriendRecord {
    const current = presence || this.store.snapshot().presence[identity.id];
    return {
      ...publicIdentity(identity),
      status: current?.status || 'offline',
      roomCode: current?.roomCode || null,
      currentGame: current?.currentGame
    };
  }

  private allocateTag(data: { identities: Record<string, StoredIdentity> }, name: string, requested?: string, exceptId?: string): string {
    const wanted = (requested || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
    const taken = new Set(
      Object.values(data.identities)
        .filter(identity => identity.id !== exceptId && identity.name.toLowerCase() === name.toLowerCase())
        .map(identity => identity.tag.toUpperCase())
    );
    if (wanted.length >= 2 && !taken.has(wanted)) return wanted.padEnd(4, '0').slice(0, 4);
    for (let attempt = 0; attempt < 10_000; attempt++) {
      const tag = String(1000 + Math.floor(Math.random() * 9000));
      if (!taken.has(tag)) return tag;
    }
    return randomBytes(2).toString('hex').toUpperCase();
  }
}
