export const NEUTRAL_AXES = [0, 0, 0, 0, 0, 0];

export function neutralGamepadPacket(slot: number, padId?: string | null) {
  return {
    type: 'gamepad',
    slot,
    buttons: 0,
    axes: [...NEUTRAL_AXES],
    id: padId || undefined,
    timestamp: Date.now()
  };
}

export function keyboardReleasePackets(keycodes: Iterable<number>) {
  return [...keycodes].sort((a, b) => a - b).map((keycode) => ({
    type: 'keyboard',
    action: 'up',
    keycode
  }));
}

export function mouseReleasePackets(buttons: Iterable<number>) {
  return [...buttons].sort((a, b) => a - b).map((button) => ({
    type: 'mouse',
    action: 'up',
    mode: 'relative',
    button
  }));
}

export function stuckReleasePackets(state: {
  slot?: number | null;
  padId?: string | null;
  keys?: Iterable<number>;
  mouseButtons?: Iterable<number>;
  kinds?: Array<'gamepad' | 'mouse' | 'keyboard'>;
}) {
  const kinds = new Set(state.kinds || ['gamepad', 'mouse', 'keyboard']);
  const packets: Record<string, unknown>[] = [];
  if (kinds.has('keyboard')) packets.push(...keyboardReleasePackets(state.keys || []));
  if (kinds.has('mouse')) packets.push(...mouseReleasePackets(state.mouseButtons || []));
  if (kinds.has('gamepad') && state.slot !== null && state.slot !== undefined) {
    packets.push(neutralGamepadPacket(state.slot, state.padId));
  }
  return packets;
}
