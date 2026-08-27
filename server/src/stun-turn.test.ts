import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ICE_SERVERS, getIceServers } from './stun-turn.js';

test('uses public STUN servers when TURN is not configured', () => {
  assert.deepEqual(getIceServers({}), DEFAULT_ICE_SERVERS);
});

test('adds configured TURN relay credentials', () => {
  const servers = getIceServers({
    TURN_URLS: 'turn:relay.example.com:3478,turns:relay.example.com:5349',
    TURN_USERNAME: 'parsage',
    TURN_CREDENTIAL: 'secret'
  });
  assert.deepEqual(servers.at(-1), {
    urls: ['turn:relay.example.com:3478', 'turns:relay.example.com:5349'],
    username: 'parsage',
    credential: 'secret'
  });
});
