/** KeyboardEvent.code → Linux KEY_* (linux/input-event-codes.h). Keep in sync with host/input_parity.py. */

export const LINUX_KEYMAP: Record<string, number> = {
  Escape: 1,
  Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5, Digit5: 6,
  Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10, Digit0: 11,
  Minus: 12, Equal: 13, Backspace: 14, Tab: 15,
  KeyQ: 16, KeyW: 17, KeyE: 18, KeyR: 19, KeyT: 20,
  KeyY: 21, KeyU: 22, KeyI: 23, KeyO: 24, KeyP: 25,
  BracketLeft: 26, BracketRight: 27, Enter: 28, ControlLeft: 29,
  KeyA: 30, KeyS: 31, KeyD: 32, KeyF: 33, KeyG: 34,
  KeyH: 35, KeyJ: 36, KeyK: 37, KeyL: 38,
  Semicolon: 39, Quote: 40, Backquote: 41, ShiftLeft: 42,
  Backslash: 43,
  KeyZ: 44, KeyX: 45, KeyC: 46, KeyV: 47, KeyB: 48,
  KeyN: 49, KeyM: 50,
  Comma: 51, Period: 52, Slash: 53, ShiftRight: 54,
  NumpadMultiply: 55, AltLeft: 56, Space: 57, CapsLock: 58,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63,
  F6: 64, F7: 65, F8: 66, F9: 67, F10: 68,
  NumLock: 69, ScrollLock: 70,
  Numpad7: 71, Numpad8: 72, Numpad9: 73, NumpadSubtract: 74,
  Numpad4: 75, Numpad5: 76, Numpad6: 77, NumpadAdd: 78,
  Numpad1: 79, Numpad2: 80, Numpad3: 81, Numpad0: 82,
  NumpadDecimal: 83,
  IntlBackslash: 86, F11: 87, F12: 88,
  NumpadEnter: 96, ControlRight: 97, NumpadDivide: 98,
  PrintScreen: 99, AltRight: 100,
  Home: 102, ArrowUp: 103, PageUp: 104, ArrowLeft: 105,
  ArrowRight: 106, End: 107, ArrowDown: 108, PageDown: 109,
  Insert: 110, Delete: 111,
  AudioVolumeMute: 113, AudioVolumeDown: 114, AudioVolumeUp: 115,
  Pause: 119, NumpadEqual: 117,
  MetaLeft: 125, OSLeft: 125, MetaRight: 126, OSRight: 126,
  ContextMenu: 127,
  F13: 183, F14: 184, F15: 185, F16: 186, F17: 187,
  F18: 188, F19: 189, F20: 190, F21: 191, F22: 192,
  F23: 193, F24: 194
};

export function linuxKeycode(code?: string | null, keycode?: number | null): number | null {
  if (code && LINUX_KEYMAP[code]) return LINUX_KEYMAP[code];
  if (typeof keycode === 'number' && keycode > 0 && keycode < 248) return keycode;
  return null;
}

export function keyboardPacket(event: { code?: string; type?: string; repeat?: boolean }): Record<string, unknown> | null {
  if (event.repeat) return null;
  const keycode = linuxKeycode(event.code);
  if (!keycode) return null;
  return {
    type: 'keyboard',
    action: event.type === 'keyup' ? 'up' : 'down',
    code: event.code,
    keycode
  };
}
