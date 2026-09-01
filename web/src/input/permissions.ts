export type InputKind = 'gamepad' | 'mouse' | 'keyboard';

export const INPUT_KINDS: InputKind[] = ['gamepad', 'mouse', 'keyboard'];

export type InputPermissions = {
  gamepad: boolean;
  mouse: boolean;
  keyboard: boolean;
  audio?: boolean;
};

export type PermissionPeer = {
  approved: boolean;
  permissions: InputPermissions;
};

export function packetKind(packet: { type?: string } | null | undefined): string | null {
  const kind = packet?.type;
  if (kind === 'gamepad' || kind === 'mouse' || kind === 'keyboard' || kind === 'release' || kind === 'rumble') {
    return kind;
  }
  return null;
}

export function packetAllowed(
  packet: { type?: string } | null | undefined,
  peer: PermissionPeer | null | undefined
): boolean {
  if (!packet || !peer) return false;
  if (packet.type === 'release') return true;
  if (!peer.approved) return false;
  if (packet.type === 'gamepad') return Boolean(peer.permissions.gamepad);
  if (packet.type === 'mouse') return Boolean(peer.permissions.mouse);
  if (packet.type === 'keyboard') return Boolean(peer.permissions.keyboard);
  return false;
}

export function revokedKinds(
  oldPermissions: Partial<InputPermissions> | null | undefined,
  newPermissions: Partial<InputPermissions> | null | undefined
): InputKind[] {
  const previous = oldPermissions || {};
  const next = newPermissions || {};
  return INPUT_KINDS.filter((kind) => previous[kind] && !next[kind]);
}

export function releasePacket(peerId: string, kinds: InputKind[] = INPUT_KINDS) {
  return { type: 'release', peerId, kinds };
}

export function selfPeer<T extends { id: string }>(
  peers: T[] | undefined,
  currentPeerId: string | null | undefined
): T | null {
  if (!peers || !currentPeerId) return null;
  return peers.find((peer) => peer.id === currentPeerId) || null;
}
