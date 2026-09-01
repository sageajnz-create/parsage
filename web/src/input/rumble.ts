export type RumbleEffect = {
  strong: number;
  weak: number;
  duration: number;
  slot?: number;
  padId?: string | null;
  peerId?: string | null;
};

export function normalizeRumble(effect: Partial<RumbleEffect> | null | undefined): RumbleEffect | null {
  if (!effect) return null;
  const strong = Math.max(0, Math.min(1, Number(effect.strong) || 0));
  const weak = Math.max(0, Math.min(1, Number(effect.weak) || 0));
  const duration = Math.max(0, Math.floor(Number(effect.duration) || 0));
  if (strong === 0 && weak === 0 && duration === 0) {
    return {
      strong: 0,
      weak: 0,
      duration: 0,
      slot: effect.slot,
      padId: effect.padId,
      peerId: effect.peerId
    };
  }
  return {
    strong,
    weak,
    duration: duration || 120,
    slot: effect.slot,
    padId: effect.padId,
    peerId: effect.peerId
  };
}

export function rumbleMatchesPad(
  effect: RumbleEffect,
  pad: { id?: string; index?: number } | null | undefined,
  assignedSlot: number | null | undefined
): boolean {
  if (!pad) return false;
  if (effect.padId) {
    return pad.id === effect.padId || `${pad.id}#${pad.index ?? 0}` === effect.padId;
  }
  if (typeof effect.slot === 'number' && assignedSlot === effect.slot) return true;
  return false;
}

export function playGamepadRumble(
  pad: Gamepad | null | undefined,
  effect: RumbleEffect
): boolean {
  const actuator = pad && ((pad as Gamepad & { vibrationActuator?: GamepadHapticActuator }).vibrationActuator);
  if (!actuator || typeof actuator.playEffect !== 'function') return false;
  actuator.playEffect('dual-rumble', {
    startDelay: 0,
    duration: Math.max(1, effect.duration),
    weakMagnitude: effect.weak,
    strongMagnitude: effect.strong
  });
  return true;
}

export function applyRumbleToMatchingPad(
  pads: Array<Gamepad | null>,
  effect: RumbleEffect,
  assignedSlot: number | null = null
): boolean {
  const normalized = normalizeRumble(effect);
  if (!normalized) return false;
  const match = pads.find((pad) => pad && rumbleMatchesPad(normalized, pad, assignedSlot)) || null;
  const fallback = typeof normalized.slot === 'number' ? pads[normalized.slot] : null;
  return playGamepadRumble(match || fallback || undefined, normalized);
}
