export const MIN_BITRATE_MBPS = 2;
export const HARD_LOSS_RATIO = 0.05;
export const SOFT_LOSS_RATIO = 0.02;
export const RECOVER_LOSS_RATIO = 0.005;
const KEYFRAME_COOLDOWN_MS = 1000;

export function clampBitrateMbps(value: unknown, ceilingMbps: number): number {
  const ceiling = Math.max(Number(ceilingMbps) || MIN_BITRATE_MBPS, MIN_BITRATE_MBPS);
  const floor = Math.max(MIN_BITRATE_MBPS, ceiling * 0.2);
  const bitrate = Number(value);
  const next = Number.isFinite(bitrate) ? bitrate : ceiling;
  return Math.min(ceiling, Math.max(floor, next));
}

export function lossRatio(packetsLostDelta: unknown, packetsDeliveredDelta: unknown): number {
  const lost = Math.max(0, Number(packetsLostDelta) || 0);
  const delivered = Math.max(0, Number(packetsDeliveredDelta) || 0);
  const observed = lost + delivered;
  if (observed <= 0) return 0;
  return lost / observed;
}

export function nextBitrateMbps(
  currentMbps: number,
  ceilingMbps: number,
  loss: number
): { bitrateMbps: number; requestKeyframe: boolean } {
  const ceiling = Math.max(Number(ceilingMbps) || MIN_BITRATE_MBPS, MIN_BITRATE_MBPS);
  const current = clampBitrateMbps(currentMbps, ceiling);
  const ratio = Math.max(0, Number(loss) || 0);
  if (ratio >= HARD_LOSS_RATIO) {
    return { bitrateMbps: clampBitrateMbps(current * 0.7, ceiling), requestKeyframe: true };
  }
  if (ratio >= SOFT_LOSS_RATIO) {
    return { bitrateMbps: clampBitrateMbps(current * 0.85, ceiling), requestKeyframe: false };
  }
  if (ratio <= RECOVER_LOSS_RATIO) {
    return { bitrateMbps: clampBitrateMbps(current * 1.05, ceiling), requestKeyframe: false };
  }
  return { bitrateMbps: current, requestKeyframe: false };
}

export function shouldForceKeyframe(
  loss: number,
  lastKeyframeAtMs: number,
  nowMs: number,
  framesDecodedDelta?: number
): boolean {
  if (nowMs - lastKeyframeAtMs < KEYFRAME_COOLDOWN_MS) return false;
  if ((Number(loss) || 0) >= HARD_LOSS_RATIO) return true;
  if (framesDecodedDelta !== undefined && framesDecodedDelta <= 0 && (Number(loss) || 0) > 0) {
    return true;
  }
  return false;
}

export type LatencyStages = {
  captureMs?: number | null;
  encodeMs?: number | null;
  networkMs?: number | null;
  decodeMs?: number | null;
  presentMs?: number | null;
};

export function dominantLatencyStage(stages: LatencyStages): keyof LatencyStages | null {
  const measured: Array<[keyof LatencyStages, number]> = [];
  (Object.keys(stages) as Array<keyof LatencyStages>).forEach((key) => {
    const value = stages[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      measured.push([key, value]);
    }
  });
  if (!measured.length) return null;
  measured.sort((a, b) => b[1] - a[1]);
  return measured[0][0];
}

export function latencyStagesFromReport(stats: Array<Record<string, unknown>>): LatencyStages {
  const stages: LatencyStages = {};
  for (const stat of stats) {
    if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
      const encoded = Number(stat.framesEncoded) || 0;
      if (encoded > 0 && typeof stat.totalEncodeTime === 'number') {
        stages.encodeMs = Number(((stat.totalEncodeTime as number) * 1000 / encoded).toFixed(2));
      }
      if (typeof stat.totalCaptureDelay === 'number' && encoded > 0) {
        stages.captureMs = Number(((stat.totalCaptureDelay as number) * 1000 / encoded).toFixed(2));
      }
    }
    if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
      const decoded = Number(stat.framesDecoded) || 0;
      if (decoded > 0 && typeof stat.totalDecodeTime === 'number') {
        stages.decodeMs = Number(((stat.totalDecodeTime as number) * 1000 / decoded).toFixed(2));
      }
      const emitted = Number(stat.jitterBufferEmittedCount) || 0;
      if (emitted > 0 && typeof stat.jitterBufferDelay === 'number') {
        stages.presentMs = Number(((stat.jitterBufferDelay as number) * 1000 / emitted).toFixed(2));
      }
    }
    if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && typeof stat.currentRoundTripTime === 'number') {
      stages.networkMs = Number(((stat.currentRoundTripTime as number) * 1000 / 2).toFixed(1));
    }
  }
  return stages;
}

export async function configureVideoSender(
  sender: RTCRtpSender,
  maxBitrateBps: number,
  maxFramerate?: number
): Promise<void> {
  const parameters = sender.getParameters();
  parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
  parameters.encodings[0].maxBitrate = maxBitrateBps;
  parameters.encodings[0].priority = 'high';
  const encoding = parameters.encodings[0] as RTCRtpEncodingParameters & { networkPriority?: string };
  encoding.networkPriority = 'high';
  if (maxFramerate && maxFramerate > 0) {
    parameters.encodings[0].maxFramerate = maxFramerate;
  }
  (parameters as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = 'maintain-framerate';
  await sender.setParameters(parameters);
}

export async function forceSenderKeyframe(sender: RTCRtpSender | null | undefined): Promise<boolean> {
  const generate = sender && (sender as RTCRtpSender & { generateKeyFrame?: () => Promise<void> }).generateKeyFrame;
  if (typeof generate !== 'function') return false;
  await generate.call(sender);
  return true;
}
