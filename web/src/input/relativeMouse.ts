export type MouseSample = { dx: number; dy: number };

export function coalescedMovement(event: {
  movementX?: number;
  movementY?: number;
  getCoalescedEvents?: () => Array<{ movementX?: number; movementY?: number }>;
}): MouseSample[] {
  const coalesced = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : null;
  if (coalesced && coalesced.length) {
    return coalesced
      .map((sample) => ({ dx: sample.movementX || 0, dy: sample.movementY || 0 }))
      .filter((sample) => sample.dx !== 0 || sample.dy !== 0);
  }
  const dx = event.movementX || 0;
  const dy = event.movementY || 0;
  return dx || dy ? [{ dx, dy }] : [];
}

export function relativeMouseMovePacket(samples: MouseSample[]) {
  if (!samples.length) return null;
  const dx = samples.reduce((sum, sample) => sum + sample.dx, 0);
  const dy = samples.reduce((sum, sample) => sum + sample.dy, 0);
  return {
    type: 'mouse',
    action: 'move',
    mode: 'relative',
    dx,
    dy,
    samples
  };
}

export function relativeMouseButtonPacket(action: 'down' | 'up', button: number) {
  return { type: 'mouse', action, mode: 'relative', button };
}

export function relativeMouseWheelPacket(deltaY: number) {
  return { type: 'mouse', action: 'wheel', mode: 'relative', deltaY };
}

export function highRateMouseSamples(count: number, dx = 1, dy = 0): MouseSample[] {
  return Array.from({ length: count }, () => ({ dx, dy }));
}
