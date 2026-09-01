import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dominantLatencyStage,
  latencyStagesFromReport,
  lossRatio,
  nextBitrateMbps,
  shouldForceKeyframe
} from './bitrateAdaptation.ts';

test('hard loss cuts bitrate and asks for a keyframe', () => {
  const result = nextBitrateMbps(20, 25, 0.08);
  assert.ok(result.bitrateMbps < 20);
  assert.equal(result.requestKeyframe, true);
});

test('a clean path climbs toward the ceiling and never passes it', () => {
  const climbing = nextBitrateMbps(10, 25, 0);
  assert.ok(climbing.bitrateMbps > 10);
  assert.ok(climbing.bitrateMbps <= 25);
  assert.equal(nextBitrateMbps(25, 25, 0).bitrateMbps, 25);
});

test('keyframe cooldown avoids a request storm', () => {
  assert.equal(shouldForceKeyframe(0.2, 9_000, 9_500), false);
  assert.equal(shouldForceKeyframe(0.2, 8_000, 10_000), true);
});

test('loss ratio is lost divided by lost plus delivered', () => {
  assert.equal(lossRatio(5, 95), 0.05);
  assert.equal(lossRatio(0, 0), 0);
});

test('latency stages come from WebRTC stats and name the slowest one', () => {
  const stages = latencyStagesFromReport([
    { type: 'outbound-rtp', kind: 'video', framesEncoded: 100, totalEncodeTime: 0.4, totalCaptureDelay: 0.2 },
    { type: 'inbound-rtp', kind: 'video', framesDecoded: 100, totalDecodeTime: 0.3, jitterBufferDelay: 0.8, jitterBufferEmittedCount: 100 },
    { type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.04 }
  ]);
  assert.equal(stages.encodeMs, 4);
  assert.equal(stages.captureMs, 2);
  assert.equal(stages.decodeMs, 3);
  assert.equal(stages.presentMs, 8);
  assert.equal(stages.networkMs, 20);
  assert.equal(dominantLatencyStage(stages), 'networkMs');
});
