export interface AccountActor {
  id: string;
  kind: 'google' | 'local';
  name: string;
  tag: string;
  email?: string;
  avatarUrl: string;
  handle: string;
}

export interface FriendRecord extends AccountActor {
  status: 'online' | 'idle' | 'hosting' | 'in-game' | 'offline';
  roomCode?: string | null;
  currentGame?: string;
}

export interface DeviceRecord {
  id: string;
  ownerId: string;
  name: string;
  platform: string;
  gpu?: string;
  lastSeen: number;
  roomCode?: string | null;
}

async function readJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

export async function listFriends(): Promise<FriendRecord[]> {
  const response = await fetch('/api/friends', { credentials: 'same-origin' });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error('Unable to load friends.');
  const body = await readJson<{ friends: FriendRecord[] }>(response);
  return body.friends;
}

export async function addFriend(handle: string): Promise<FriendRecord> {
  const response = await fetch('/api/friends', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle })
  });
  const body = await readJson<{ friend?: FriendRecord; error?: string }>(response);
  if (!response.ok || !body.friend) throw new Error(body.error || 'Friend not found.');
  return body.friend;
}

export async function removeFriend(id: string): Promise<void> {
  await fetch(`/api/friends/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
}

export async function listDevices(): Promise<DeviceRecord[]> {
  const response = await fetch('/api/devices', { credentials: 'same-origin' });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error('Unable to load devices.');
  return (await readJson<{ devices: DeviceRecord[] }>(response)).devices;
}

export async function registerDevice(input: { name: string; platform?: string; gpu?: string }): Promise<DeviceRecord> {
  const response = await fetch('/api/devices', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  const body = await readJson<{ device?: DeviceRecord; error?: string }>(response);
  if (!response.ok || !body.device) throw new Error(body.error || 'Unable to register this computer.');
  return body.device;
}

export async function removeDevice(id: string): Promise<void> {
  await fetch(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
}

export async function createQuickLink(roomCode: string, expiresInMs = 24 * 60 * 60_000): Promise<{ token: string; url: string; expiresAt: number }> {
  const response = await fetch('/api/quick-links', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode, expiresInMs })
  });
  const body = await readJson<{ token?: string; url?: string; expiresAt?: number; error?: string }>(response);
  if (!response.ok || !body.token || !body.url) throw new Error(body.error || 'Unable to create a share link.');
  return { token: body.token, url: body.url, expiresAt: body.expiresAt || 0 };
}

export async function resolveQuickLink(token: string): Promise<{ roomCode: string; expiresAt: number }> {
  const response = await fetch(`/api/quick-links/${encodeURIComponent(token)}`, { credentials: 'same-origin' });
  const body = await readJson<{ roomCode?: string; expiresAt?: number; error?: string }>(response);
  if (!response.ok || !body.roomCode) throw new Error(body.error || 'This share link has expired or been revoked.');
  return { roomCode: body.roomCode, expiresAt: body.expiresAt || 0 };
}

export async function revokeQuickLink(token: string): Promise<void> {
  const response = await fetch(`/api/quick-links/${encodeURIComponent(token)}`, {
    method: 'DELETE',
    credentials: 'same-origin'
  });
  if (!response.ok) throw new Error('Unable to revoke that share link.');
}
