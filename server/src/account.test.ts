import assert from 'node:assert/strict';
import test from 'node:test';
import { AccountRegistry } from './account.js';
import { DurableStore } from './store.js';

function registry(now = 1_700_000_000_000) {
  let clock = now;
  return {
    accounts: new AccountRegistry(DurableStore.memory(), () => clock),
    tick(ms: number) { clock += ms; }
  };
}

test('persists identities, friendships, devices, and presence', () => {
  const { accounts } = registry();
  const sage = accounts.upsertGoogleIdentity({
    id: 'google-sage',
    name: 'Sage',
    email: 'sage@example.com',
    avatarUrl: 'https://example.com/sage.png'
  });
  const ant = accounts.createLocalIdentity({ name: 'Antigravity', tag: '0420' });
  accounts.setPresence(ant.identity.id, 'hosting', { roomCode: 'PARSAGE-ZION-ABCD2345' });
  const friend = accounts.addFriend(sage.id, 'Antigravity#0420');
  assert.equal(friend.id, ant.identity.id);
  assert.equal(friend.status, 'hosting');
  assert.equal(friend.roomCode, 'PARSAGE-ZION-ABCD2345');

  const device = accounts.registerDevice(sage.id, { name: 'Omarchy Rig', platform: 'linux', gpu: 'RX 6650 XT' });
  assert.equal(accounts.listDevices(sage.id)[0].id, device.id);
  accounts.removeDevice(sage.id, device.id);
  assert.equal(accounts.listDevices(sage.id).length, 0);
  accounts.removeFriend(sage.id, ant.identity.id);
  assert.equal(accounts.listFriends(sage.id).length, 0);
});

test('quick links expire and can be revoked', () => {
  const { accounts, tick } = registry();
  const owner = accounts.createLocalIdentity({ name: 'Host' });
  const created = accounts.createQuickLink(owner.identity.id, 'PARSAGE-IRIE-ABCD2345', 60_000);
  assert.equal(accounts.resolveQuickLink(created.token)?.roomCode, 'PARSAGE-IRIE-ABCD2345');
  assert.equal(accounts.revokeQuickLink(owner.identity.id, created.token), true);
  assert.equal(accounts.resolveQuickLink(created.token), null);

  const second = accounts.createQuickLink(owner.identity.id, 'PARSAGE-IRIE-ABCD2345', 60_000);
  tick(60_001);
  assert.equal(accounts.resolveQuickLink(second.token), null);
});
