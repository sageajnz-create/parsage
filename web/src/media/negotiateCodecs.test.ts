import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advertisedCodecsFromNames,
  applyCodecPreferences,
  codecsFromSdp,
  negotiateVideoCodecs,
  orderCodecCapabilities
} from './negotiateCodecs.ts';

test('H.264 is the only codec until the remote peer advertises extras', () => {
  assert.deepEqual(negotiateVideoCodecs(['h264', 'hevc', 'av1'], null), ['h264']);
});

test('HEVC and AV1 are added only when both peers advertise them', () => {
  assert.deepEqual(negotiateVideoCodecs(['h264', 'hevc', 'av1'], ['h264']), ['h264']);
  assert.deepEqual(negotiateVideoCodecs(['h264', 'hevc'], ['h264', 'hevc', 'av1']), ['h264', 'hevc']);
  assert.deepEqual(negotiateVideoCodecs(['h264', 'av1'], ['h264', 'av1']), ['h264', 'av1']);
});

test('a HEVC preference cannot win unless both peers advertised HEVC', () => {
  assert.deepEqual(
    negotiateVideoCodecs(['h264', 'hevc'], ['h264'], 'hevc'),
    ['h264']
  );
  assert.deepEqual(
    negotiateVideoCodecs(['h264', 'hevc'], ['h264', 'hevc'], 'hevc'),
    ['hevc', 'h264']
  );
});

test('SDP rtpmap lines and MIME names normalize to h264/hevc/av1', () => {
  const sdp = [
    'm=video 9 UDP/TLS/RTP/SAVPF 96 97 98',
    'a=rtpmap:96 H264/90000',
    'a=rtpmap:97 H265/90000',
    'a=rtpmap:98 AV1/90000',
    'a=rtpmap:99 VP8/90000'
  ].join('\n');
  assert.deepEqual(codecsFromSdp(sdp), ['h264', 'hevc', 'av1']);
  assert.deepEqual(advertisedCodecsFromNames(['video/H264', 'H.265', 'AV1']), ['h264', 'hevc', 'av1']);
});

test('codec preferences keep H.264 first and retain RTX/FEC helpers', () => {
  const ordered = orderCodecCapabilities([
    { mimeType: 'video/VP8' },
    { mimeType: 'video/AV1' },
    { mimeType: 'video/H264' },
    { mimeType: 'video/rtx' },
    { mimeType: 'video/ulpfec' }
  ], ['h264']);
  assert.equal(ordered[0].mimeType, 'video/H264');
  assert.ok(ordered.some((codec) => codec.mimeType === 'video/rtx'));
  assert.ok(!ordered.some((codec) => codec.mimeType === 'video/VP8'));
  assert.ok(!ordered.some((codec) => codec.mimeType === 'video/AV1'));
});

test('codec preference application is a no-op without getTransceivers', () => {
  applyCodecPreferences({} as RTCPeerConnection, [{ mimeType: 'video/H264' } as RTCRtpCodec]);
});
