export const SLOT_COUNT = 4;

export class ControllerBindings {
  readonly slotCount: number;
  private byIdentity = new Map<string, number>();
  private bySlot: Array<string | null>;

  constructor(slotCount = SLOT_COUNT) {
    this.slotCount = slotCount;
    this.bySlot = Array.from({ length: slotCount }, () => null);
  }

  slotFor(identity: string | null | undefined): number | null {
    if (!identity) return null;
    const slot = this.byIdentity.get(identity);
    return slot === undefined ? null : slot;
  }

  identityFor(slot: number | null | undefined): string | null {
    if (slot === null || slot === undefined || slot < 0 || slot >= this.slotCount) return null;
    return this.bySlot[slot];
  }

  bind(identity: string | null | undefined, preferredSlot: number | null = null): number | null {
    if (!identity) return null;
    const existing = this.byIdentity.get(identity);
    if (existing !== undefined) {
      if (preferredSlot === null || preferredSlot === existing) return existing;
      this.unbind(identity);
    }
    let slot = preferredSlot;
    if (slot === null || slot < 0 || slot >= this.slotCount || (this.bySlot[slot] && this.bySlot[slot] !== identity)) {
      slot = this.bySlot.findIndex((occupant) => occupant === null);
    }
    if (slot < 0) return null;
    const occupant = this.bySlot[slot];
    if (occupant && occupant !== identity) return null;
    this.bySlot[slot] = identity;
    this.byIdentity.set(identity, slot);
    return slot;
  }

  unbind(identity: string | null | undefined): number | null {
    if (!identity) return null;
    const slot = this.byIdentity.get(identity);
    if (slot === undefined) return null;
    this.byIdentity.delete(identity);
    if (this.bySlot[slot] === identity) this.bySlot[slot] = null;
    return slot;
  }

  unbindSlot(slot: number | null | undefined): string | null {
    const identity = this.identityFor(slot);
    if (identity) this.unbind(identity);
    return identity;
  }

  reindex(identities: string[]): Array<number | null> {
    return identities.map((identity) => this.slotFor(identity));
  }
}

export function padIdentity(pad: { id?: string; index?: number } | null | undefined): string | null {
  if (!pad) return null;
  if (pad.id) return `${pad.id}#${pad.index ?? 0}`;
  if (typeof pad.index === 'number') return `index:${pad.index}`;
  return null;
}
