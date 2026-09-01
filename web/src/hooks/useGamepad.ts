import { useState, useEffect, useRef, useCallback } from 'react';
import { GamepadState } from '../types';

export function useGamepad() {
  const [gamepads, setGamepads] = useState<GamepadState[]>([]);
  const [activeGamepadIndex, setActiveGamepadIndex] = useState<number | null>(null);
  const [deadzone, setDeadzone] = useState<number>(0.08);

  const requestRef = useRef<number | null>(null);
  const lastStateRef = useRef<Map<number, number>>(new Map()); // index -> bitmask

  const updateGamepads = useCallback(() => {
    const rawPads = navigator.getGamepads ? navigator.getGamepads() : [];
    const activeList: GamepadState[] = [];

    for (let i = 0; i < rawPads.length; i++) {
      const pad = rawPads[i];
      if (!pad) continue;

      const buttons = pad.buttons.map(b => b.pressed);
      const buttonValues = pad.buttons.map(b => b.value);
      const axes = pad.axes.map(a => {
        // Apply deadzone
        if (Math.abs(a) < deadzone) return 0;
        return a;
      });

      activeList.push({
        index: pad.index,
        id: pad.id,
        connected: pad.connected,
        buttons,
        buttonValues,
        axes,
        timestamp: pad.timestamp
      });
    }

    setGamepads(activeList);
    if (activeList.length > 0 && activeGamepadIndex === null) {
      setActiveGamepadIndex(activeList[0].index);
    }

    requestRef.current = requestAnimationFrame(updateGamepads);
  }, [deadzone, activeGamepadIndex]);

  useEffect(() => {
    const handleConnected = (e: GamepadEvent) => {
      console.log(`[Gamepad] Connected: ${e.gamepad.id} at index ${e.gamepad.index}`);
      if (activeGamepadIndex === null) {
        setActiveGamepadIndex(e.gamepad.index);
      }
    };

    const handleDisconnected = (e: GamepadEvent) => {
      console.log(`[Gamepad] Disconnected: ${e.gamepad.id}`);
      if (activeGamepadIndex === e.gamepad.index) {
        setActiveGamepadIndex(null);
      }
    };

    window.addEventListener('gamepadconnected', handleConnected);
    window.addEventListener('gamepaddisconnected', handleDisconnected);

    requestRef.current = requestAnimationFrame(updateGamepads);

    return () => {
      window.removeEventListener('gamepadconnected', handleConnected);
      window.removeEventListener('gamepaddisconnected', handleDisconnected);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [updateGamepads, activeGamepadIndex]);

  const testVibration = useCallback((index?: number, durationMs = 300) => {
    const targetIdx = index ?? activeGamepadIndex ?? 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[targetIdx];

    if (pad && (pad as any).vibrationActuator) {
      (pad as any).vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: durationMs,
        weakMagnitude: 0.7,
        strongMagnitude: 1.0
      });
      return true;
    }
    return false;
  }, [activeGamepadIndex]);

  const packGamepadState = useCallback((pad: GamepadState, slot: number) => {
    let buttonsMask = 0;
    for (let i = 0; i < 17; i++) {
      if (pad.buttons[i]) {
        buttonsMask |= (1 << i);
      }
    }

    // LT (axis or button 6) and RT (axis or button 7)
    const lt = pad.buttonValues[6] ?? (pad.axes[2] > 0 ? pad.axes[2] : 0);
    const rt = pad.buttonValues[7] ?? (pad.axes[5] > 0 ? pad.axes[5] : 0);

    const axes = [
      pad.axes[0] ?? 0, // LX
      pad.axes[1] ?? 0, // LY
      pad.axes[2] ?? 0, // RX (or pad.axes[3] on some layout)
      pad.axes[3] ?? 0, // RY
      lt,
      rt
    ];

    return {
      type: 'gamepad',
      slot,
      buttons: buttonsMask,
      axes,
      id: pad.id,
      timestamp: Date.now()
    };
  }, []);

  return {
    gamepads,
    activeGamepadIndex,
    setActiveGamepadIndex,
    deadzone,
    setDeadzone,
    testVibration,
    packGamepadState
  };
}
