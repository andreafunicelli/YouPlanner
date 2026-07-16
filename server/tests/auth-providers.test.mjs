import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../index.mjs';
import { resetState } from '../store.mjs';

async function withServer(fn) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function json(base, path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, payload: await response.json() };
}

test('auth config exposes enabled demo providers without internal user ids', async () => {
  await withServer(async (base) => {
    const response = await json(base, '/api/auth/config');
    assert.equal(response.status, 200);
    assert.equal(response.payload.mode, 'demo');
    assert.equal(response.payload.providers.ldap.enabled, true);
    assert.equal(response.payload.providers.google.enabled, true);
    assert.equal(response.payload.providers.google.domain, 'youco.demo');
    assert.equal('userId' in response.payload.providers.ldap.identities[0], false);
    assert.equal('userId' in response.payload.providers.google.identities[0], false);
  });
});

test('LDAP demo login maps identity to role and logout revokes the opaque session', async () => {
  await resetState();
  await withServer(async (base) => {
    const rejected = await json(base, '/api/auth/ldap', { method: 'POST', body: { username: 'elena.conti', password: 'wrong' } });
    assert.equal(rejected.status, 401);
    assert.equal(rejected.payload.error, 'LDAP_BAD_CREDENTIALS');

    const login = await json(base, '/api/auth/ldap', { method: 'POST', body: { username: 'elena.conti', password: 'Demo!2026' } });
    assert.equal(login.status, 200);
    assert.equal(login.payload.provider, 'ldap');
    assert.equal(login.payload.user.role, 'ADMIN');
    assert.notEqual(login.payload.token, login.payload.user.id);
    assert.ok(login.payload.token.length >= 40);

    const bootstrap = await json(base, '/api/bootstrap', { token: login.payload.token });
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.payload.user.email, 'manager@peopleplanner.local');

    const logout = await json(base, '/api/auth/logout', { token: login.payload.token, method: 'POST' });
    assert.equal(logout.status, 200);
    const afterLogout = await json(base, '/api/bootstrap', { token: login.payload.token });
    assert.equal(afterLogout.status, 401);
  });
});

test('Google Workspace demo login enforces the configured fake domain and account allowlist', async () => {
  await resetState();
  await withServer(async (base) => {
    const rejected = await json(base, '/api/auth/google', { method: 'POST', body: { email: 'giulia.romano@gmail.com' } });
    assert.equal(rejected.status, 401);
    assert.equal(rejected.payload.error, 'GOOGLE_ACCOUNT_DENIED');

    const login = await json(base, '/api/auth/google', { method: 'POST', body: { email: 'giulia.romano@youco.demo' } });
    assert.equal(login.status, 200);
    assert.equal(login.payload.provider, 'google');
    assert.equal(login.payload.user.role, 'EMPLOYEE');
    const bootstrap = await json(base, '/api/bootstrap', { token: login.payload.token });
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.payload.user.employeeId, 'e3');
  });
});
