import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type PresenceStatus = 'online' | 'idle' | 'hosting' | 'in-game' | 'offline';

export interface StoredIdentity {
  id: string;
  kind: 'google' | 'local';
  name: string;
  tag: string;
  email?: string;
  avatarUrl: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoredSession {
  tokenHash: string;
  identityId: string;
  kind: 'google' | 'local';
  expiresAt: number;
}

export interface StoredDevice {
  id: string;
  ownerId: string;
  name: string;
  platform: string;
  gpu?: string;
  lastSeen: number;
  roomCode?: string | null;
}

export interface StoredFriendship {
  id: string;
  a: string;
  b: string;
  createdAt: number;
}

export interface StoredPresence {
  identityId: string;
  status: PresenceStatus;
  roomCode?: string | null;
  currentGame?: string;
  updatedAt: number;
}

export interface StoredQuickLink {
  tokenHash: string;
  roomCode: string;
  ownerId: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
}

export interface StoreData {
  identities: Record<string, StoredIdentity>;
  sessions: Record<string, StoredSession>;
  devices: Record<string, StoredDevice>;
  friendships: StoredFriendship[];
  presence: Record<string, StoredPresence>;
  quickLinks: Record<string, StoredQuickLink>;
}

function emptyData(): StoreData {
  return {
    identities: {},
    sessions: {},
    devices: {},
    friendships: [],
    presence: {},
    quickLinks: {}
  };
}

export function defaultStorePath(): string {
  if (process.env.PARSAGE_STORE_PATH) return process.env.PARSAGE_STORE_PATH;
  const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(dataHome, 'parsage', 'store.json');
}

export class DurableStore {
  private data: StoreData;
  readonly path: string | null;

  private constructor(filePath: string | null, data: StoreData) {
    this.path = filePath;
    this.data = data;
  }

  static memory(seed?: Partial<StoreData>): DurableStore {
    return new DurableStore(null, { ...emptyData(), ...seed });
  }

  static open(filePath = defaultStorePath()): DurableStore {
    let data = emptyData();
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<StoreData>;
        data = {
          identities: parsed.identities || {},
          sessions: parsed.sessions || {},
          devices: parsed.devices || {},
          friendships: Array.isArray(parsed.friendships) ? parsed.friendships : [],
          presence: parsed.presence || {},
          quickLinks: parsed.quickLinks || {}
        };
      }
    } catch {
      data = emptyData();
    }
    for (const presence of Object.values(data.presence)) {
      presence.status = 'offline';
      presence.roomCode = null;
    }
    return new DurableStore(filePath, data);
  }

  snapshot(): StoreData {
    return structuredClone(this.data);
  }

  mutate(fn: (data: StoreData) => void): void {
    fn(this.data);
    this.flush();
  }

  private flush(): void {
    if (!this.path) return;
    fs.mkdirSync(path.dirname(this.path), { recursive: true, mode: 0o700 });
    const tmp = `${this.path}.${process.pid}.tmp`;
    const payload = JSON.stringify(this.data, null, 2);
    fs.writeFileSync(tmp, payload, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, this.path);
  }
}
