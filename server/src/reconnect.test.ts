import assert from 'node:assert/strict';
import test from 'node:test';
import { ReconnectRegistry } from './reconnect.js';

test('issues opaque reconnect credentials and resolves their peer', () => {
  const registry = new ReconnectRegistry();
  const token = registry.issue('peer-one');
  assert.ok(token.length >= 40);
  assert.equal(registry.resolve(token), 'peer-one');
  assert.equal(registry.resolve('not-the-token'), null);
});

test('rotates credentials after resumption and invalidates the old token', () => {
  const registry = new ReconnectRegistry();
  const oldToken = registry.issue('peer-one');
  registry.issue('temporary-peer');
  const rotated = registry.rotate('peer-one', 'temporary-peer');

  assert.equal(registry.resolve(oldToken), null);
  assert.equal(registry.resolve(rotated), 'peer-one');
});

test('adopts the new socket credential when a session resumes', () => {
  const registry = new ReconnectRegistry();
  const oldToken = registry.issue('peer-one');
  const newSocketToken = registry.issue('temporary-peer');
  registry.rotate('peer-one', 'temporary-peer', newSocketToken);

  assert.equal(registry.resolve(oldToken), null);
  assert.equal(registry.resolve(newSocketToken), 'peer-one');
});
