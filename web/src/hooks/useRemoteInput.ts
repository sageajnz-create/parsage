import { useEffect, useRef } from 'react';
import { keyboardPacket } from '../input/linuxKeymap';
import { packetAllowed, type PermissionPeer } from '../input/permissions';
import {
  coalescedMovement,
  relativeMouseButtonPacket,
  relativeMouseMovePacket,
  relativeMouseWheelPacket
} from '../input/relativeMouse';
import { stuckReleasePackets } from '../input/release';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function useRemoteInput({
  enabled,
  peer,
  videoRef,
  onSendInput
}: {
  enabled: boolean;
  peer: PermissionPeer | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onSendInput: (packet: unknown) => void;
}) {
  const peerRef = useRef(peer);
  const sendRef = useRef(onSendInput);
  const keysRef = useRef(new Set<number>());
  const buttonsRef = useRef(new Set<number>());
  peerRef.current = peer;
  sendRef.current = onSendInput;

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return;

    const sendIfAllowed = (packet: Record<string, unknown> | null) => {
      if (!packet) return;
      if (!packetAllowed(packet, peerRef.current)) return;
      sendRef.current(packet);
    };

    const releaseHeld = (kinds: Array<'mouse' | 'keyboard'> = ['mouse', 'keyboard']) => {
      const packets = stuckReleasePackets({
        keys: keysRef.current,
        mouseButtons: buttonsRef.current,
        kinds
      });
      keysRef.current.clear();
      buttonsRef.current.clear();
      packets.forEach((packet) => sendRef.current(packet));
    };

    const onPointerMove = (event: PointerEvent) => {
      if (document.pointerLockElement !== video) return;
      sendIfAllowed(relativeMouseMovePacket(coalescedMovement(event)));
    };
    const onPointerDown = (event: PointerEvent) => {
      if (document.pointerLockElement !== video) {
        video.requestPointerLock?.();
        return;
      }
      buttonsRef.current.add(event.button);
      sendIfAllowed(relativeMouseButtonPacket('down', event.button));
    };
    const onPointerUp = (event: PointerEvent) => {
      if (document.pointerLockElement !== video) return;
      buttonsRef.current.delete(event.button);
      sendIfAllowed(relativeMouseButtonPacket('up', event.button));
    };
    const onWheel = (event: WheelEvent) => {
      if (document.pointerLockElement !== video) return;
      event.preventDefault();
      sendIfAllowed(relativeMouseWheelPacket(event.deltaY));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.pointerLockElement !== video || isTypingTarget(event.target)) return;
      const packet = keyboardPacket(event);
      if (!packet) return;
      event.preventDefault();
      if (typeof packet.keycode === 'number') keysRef.current.add(packet.keycode);
      sendIfAllowed(packet);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (document.pointerLockElement !== video || isTypingTarget(event.target)) return;
      const packet = keyboardPacket(event);
      if (!packet) return;
      event.preventDefault();
      if (typeof packet.keycode === 'number') keysRef.current.delete(packet.keycode);
      sendIfAllowed(packet);
    };
    const onPointerLockChange = () => {
      if (document.pointerLockElement !== video) releaseHeld();
    };

    video.addEventListener('pointermove', onPointerMove);
    video.addEventListener('pointerdown', onPointerDown);
    video.addEventListener('pointerup', onPointerUp);
    video.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      video.removeEventListener('pointermove', onPointerMove);
      video.removeEventListener('pointerdown', onPointerDown);
      video.removeEventListener('pointerup', onPointerUp);
      video.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      releaseHeld();
    };
  }, [enabled, videoRef]);

  useEffect(() => {
    if (peer?.permissions.keyboard && peer?.permissions.mouse) return;
    const kinds: Array<'mouse' | 'keyboard'> = [];
    if (!peer?.permissions.keyboard) kinds.push('keyboard');
    if (!peer?.permissions.mouse) kinds.push('mouse');
    if (!kinds.length) return;
    const packets = stuckReleasePackets({
      keys: keysRef.current,
      mouseButtons: buttonsRef.current,
      kinds
    });
    if (kinds.includes('keyboard')) keysRef.current.clear();
    if (kinds.includes('mouse')) buttonsRef.current.clear();
    packets.forEach((packet) => sendRef.current(packet));
  }, [peer?.permissions.keyboard, peer?.permissions.mouse]);
}
