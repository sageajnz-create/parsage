export {};

declare global {
  interface Window {
    parsage?: {
      sendInputPacket(packet: unknown): void;
      openExternal?(url: string): Promise<boolean>;
      startNativePeer?(options: {
        targetPeerId: string;
        fps: number;
        bitrate: number;
        codecs?: string[];
        preference?: string;
      }): Promise<{ ok: boolean; error?: string }>;
      signalNativePeer?(payload: { targetPeerId: string; message: unknown }): void;
      stopNativePeer?(): Promise<boolean>;
      onNativePeerMessage?(callback: (payload: { targetPeerId: string; message: any }) => void): () => void;
    };
  }
}
