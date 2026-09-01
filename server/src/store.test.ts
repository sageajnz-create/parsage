import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DurableStore } from './store.js';

test('durable store survives process-style reopen and marks presence offline', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'parsage-store-')), 'store.json');
  const first = DurableStore.open(file);
  first.mutate(data => {
    data.identities.sage = {
      id: 'sage',
      kind: 'local',
      name: 'Sage',
      tag: '1337',
      avatarUrl: '',
      createdAt: 1,
      updatedAt: 1
    };
    data.presence.sage = {
      identityId: 'sage',
      status: 'hosting',
      roomCode: 'PARSAGE-TEST-ABCDEFGH',
      updatedAt: 1
    };
  });

  const second = DurableStore.open(file);
  const snapshot = second.snapshot();
  assert.equal(snapshot.identities.sage.name, 'Sage');
  assert.equal(snapshot.presence.sage.status, 'offline');
  assert.equal(snapshot.presence.sage.roomCode, null);
});
