export type VideoCodec = 'h264' | 'hevc' | 'av1';
export type CodecPreference = VideoCodec | 'auto';

const VIDEO_CODECS: VideoCodec[] = ['h264', 'hevc', 'av1'];

const MIME_BY_CODEC: Record<VideoCodec, string> = {
  h264: 'video/H264',
  hevc: 'video/H265',
  av1: 'video/AV1'
};

export function normalizeCodecName(name: unknown): VideoCodec | null {
  if (typeof name !== 'string') return null;
  const token = name.trim().toLowerCase().replace('video/', '').replace(/\./g, '');
  if (token === 'h264' || token === 'avc' || token === 'avc1') return 'h264';
  if (token === 'h265' || token === 'hevc' || token === 'hev1' || token === 'hvc1') return 'hevc';
  if (token === 'av1' || token === 'av01') return 'av1';
  return null;
}

export function advertisedCodecsFromNames(names: unknown): VideoCodec[] {
  const found: VideoCodec[] = [];
  if (!Array.isArray(names)) return found;
  for (const name of names) {
    const codec = normalizeCodecName(name);
    if (codec && !found.includes(codec)) found.push(codec);
  }
  return VIDEO_CODECS.filter((codec) => found.includes(codec));
}

export function codecsFromSdp(sdpText: unknown): VideoCodec[] {
  if (typeof sdpText !== 'string') return [];
  const names: string[] = [];
  for (const line of sdpText.split(/\r?\n/)) {
    const stripped = line.trim();
    if (stripped.startsWith('a=rtpmap:')) {
      const parts = stripped.split(/\s+/);
      if (parts.length >= 2) names.push(parts[1].split('/')[0]);
    }
  }
  return advertisedCodecsFromNames(names);
}

export function negotiateVideoCodecs(
  localCodecs: unknown,
  remoteCodecs: unknown = null,
  preference: CodecPreference | string = 'h264'
): VideoCodec[] {
  const local = advertisedCodecsFromNames(localCodecs);
  const remote = remoteCodecs == null ? null : advertisedCodecsFromNames(remoteCodecs);
  const preferred = normalizeCodecName(preference) || 'h264';

  const allowed = (codec: VideoCodec) => {
    if (!local.includes(codec)) return false;
    if (remote == null) return codec === 'h264';
    return remote.includes(codec);
  };

  const ordered: VideoCodec[] = [];
  if ((preferred === 'hevc' || preferred === 'av1') && allowed(preferred)) {
    ordered.push(preferred);
  }
  if (allowed('h264') && !ordered.includes('h264')) ordered.push('h264');
  if (remote != null) {
    for (const codec of ['hevc', 'av1'] as VideoCodec[]) {
      if (allowed(codec) && !ordered.includes(codec)) ordered.push(codec);
    }
  }
  if (ordered.length) return ordered;
  if (local.includes('h264')) return ['h264'];
  return local.slice(0, 1);
}

export function mimeTypeForCodec(codec: VideoCodec): string {
  return MIME_BY_CODEC[codec];
}

export function advertisedCodecsFromCapabilities(
  capabilities: { codecs?: Array<{ mimeType?: string }> } | null | undefined
): VideoCodec[] {
  const names = (capabilities?.codecs || []).map((codec) => codec.mimeType || '');
  return advertisedCodecsFromNames(names);
}

export function orderCodecCapabilities<T extends { mimeType: string }>(
  localCodecs: T[],
  preferred: VideoCodec[]
): T[] {
  const preferredMimes = preferred.map((codec) => MIME_BY_CODEC[codec].toLowerCase());
  const selected: T[] = [];
  const used = new Set<T>();
  for (const mime of preferredMimes) {
    for (const codec of localCodecs) {
      if (codec.mimeType.toLowerCase() === mime && !used.has(codec)) {
        selected.push(codec);
        used.add(codec);
      }
    }
  }
  for (const codec of localCodecs) {
    const mime = codec.mimeType.toLowerCase();
    if (mime.includes('rtx') || mime.includes('red') || mime.includes('ulpfec') || mime.includes('flexfec')) {
      if (!used.has(codec)) {
        selected.push(codec);
        used.add(codec);
      }
    }
  }
  return selected;
}

export function applyCodecPreferences(
  pc: RTCPeerConnection,
  orderedCodecs: RTCRtpCodec[]
): void {
  if (!orderedCodecs.length) return;
  for (const transceiver of pc.getTransceivers()) {
    if (typeof transceiver.setCodecPreferences === 'function') {
      transceiver.setCodecPreferences(orderedCodecs);
    }
  }
}

export function probeLocalVideoCodecs(): { encode: VideoCodec[]; decode: VideoCodec[] } {
  const rtc = globalThis.RTCRtpReceiver;
  const sender = globalThis.RTCRtpSender;
  return {
    encode: advertisedCodecsFromCapabilities(sender?.getCapabilities?.('video')),
    decode: advertisedCodecsFromCapabilities(rtc?.getCapabilities?.('video'))
  };
}

export function preferPeerVideoCodecs(
  pc: RTCPeerConnection,
  remoteCodecs: VideoCodec[] | null,
  preference: CodecPreference | string,
  sending: boolean
): VideoCodec[] {
  const local = probeLocalVideoCodecs();
  // Viewers list every codec they can decode (H.264 first) so the host can see
  // HEVC/AV1 support. Senders only add HEVC/AV1 when the viewer advertised them.
  const negotiated = sending
    ? negotiateVideoCodecs(local.encode, remoteCodecs, preference)
    : negotiateVideoCodecs(local.decode, local.decode, preference);
  const capabilities = sending
    ? globalThis.RTCRtpSender?.getCapabilities?.('video')
    : globalThis.RTCRtpReceiver?.getCapabilities?.('video');
  if (capabilities?.codecs?.length) {
    applyCodecPreferences(pc, orderCodecCapabilities(capabilities.codecs, negotiated));
  }
  return negotiated;
}
