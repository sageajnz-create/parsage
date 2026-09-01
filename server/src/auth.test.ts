import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService, parseCookies } from './auth.js';

const clientId = '123-real-client.apps.googleusercontent.com';

test('creates an HttpOnly session only after verified Google identity', async () => {
  const auth = new AuthService(clientId, async (_credential, audience) => ({
    iss: 'https://accounts.google.com',
    aud: audience,
    sub: 'google-user-123',
    email: 'sage@example.com',
    email_verified: true,
    name: 'Sage',
    picture: 'https://example.com/avatar.png',
    iat: 1,
    exp: 2
  }));

  const { token, profile } = await auth.login('signed-google-id-token');
  const cookie = auth.sessionCookie(token);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.equal(auth.getProfile(cookie)?.id, 'google-user-123');
  assert.equal(profile.email, 'sage@example.com');

  auth.logout(cookie);
  assert.equal(auth.getProfile(cookie), null);
});

test('rejects unverified email identities and placeholder configuration', async () => {
  const unverified = new AuthService(clientId, async () => ({
    iss: 'https://accounts.google.com', aud: clientId, sub: '1', email: 'x@example.com',
    email_verified: false, iat: 1, exp: 2
  }));
  await assert.rejects(() => unverified.login('credential'), /verified account/);

  const placeholder = new AuthService('982736182941-parsagedemoapp.apps.googleusercontent.com');
  await assert.rejects(() => placeholder.login('credential'), /not configured/);
});

test('parses cookie values without truncating equals characters', () => {
  assert.deepEqual(parseCookies('a=one; parsage_session=abc==; z=last'), {
    a: 'one', parsage_session: 'abc==', z: 'last'
  });
});

test('pairs an externally authenticated browser with a desktop session once', async () => {
  const auth = new AuthService(clientId, async () => ({
    iss: 'https://accounts.google.com', aud: clientId, sub: 'pair-user',
    email: 'pair@example.com', email_verified: true, name: 'Pair User', iat: 1, exp: 2
  }));
  const login = await auth.login('credential');
  const pairing = auth.createPairing();
  assert.equal(auth.claimPairing(pairing.id, 'wrong-secret'), null);
  assert.equal(auth.completePairing(pairing.id, login.profile), true);
  const claimed = auth.claimPairing(pairing.id, pairing.secret);
  assert.equal(claimed?.profile.id, 'pair-user');
  assert.equal(auth.claimPairing(pairing.id, pairing.secret), null);
});

test('persists Google sessions across AuthService instances sharing a store', async () => {
  const { DurableStore } = await import('./store.js');
  const { AccountRegistry } = await import('./account.js');
  const store = DurableStore.memory();
  const accounts = new AccountRegistry(store);
  const first = new AuthService(clientId, async () => ({
    iss: 'https://accounts.google.com', aud: clientId, sub: 'persist-user',
    email: 'persist@example.com', email_verified: true, name: 'Persist', iat: 1, exp: 2
  }), accounts);
  const login = await first.login('credential');
  const cookie = first.sessionCookie(login.token);
  const second = new AuthService(clientId, async () => undefined, accounts);
  assert.equal(second.getProfile(cookie)?.id, 'persist-user');
  assert.equal(second.getActor(cookie)?.handle.startsWith('Persist#'), true);
});
