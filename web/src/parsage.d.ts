export {};

declare global {
  interface Window {
    parsage?: {
      sendInputPacket(packet: unknown): void;
      openExternal?(url: string): Promise<boolean>;
    };
  }
}
