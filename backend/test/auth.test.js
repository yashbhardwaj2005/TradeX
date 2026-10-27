import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup, teardown } from './helpers.js';
let app, token, cookie;
before(async () => {
  app = await setup();
});
after(teardown);
test('frontend readiness endpoint is public and reports the connected database', async () => {
  const response = await request(app).get('/api/v1/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.database, 'connected');
  assert.equal(response.body.data.service, 'tradex');
});
test('registration initializes virtual funds without signing in or issuing credentials', async () => {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName: 'Test Trader', email: 'trader@example.com', password: 'a-secure-password' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.virtualBalance, 100000000);
  assert.equal(res.body.data.user.passwordHash, undefined);
  assert.equal(res.body.data.accessToken, undefined);
  assert.equal(res.body.data.refreshToken, undefined);
  assert.equal(res.headers['set-cookie'], undefined);
  const { TokenSession } = await import('../src/models/index.js');
  assert.equal(await TokenSession.countDocuments(), 0);
  assert.equal((await request(app).post('/api/v1/auth/refresh')).status, 401);
  assert.equal((await request(app).get('/api/v1/auth/me')).status, 401);
});
test('login verifies password', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'trader@example.com', password: 'a-secure-password' });
  assert.equal(res.status, 200);
  token = res.body.data.accessToken;
  cookie = res.headers['set-cookie'][0];
  assert.ok(token);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const bad = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'trader@example.com', password: 'wrong-password' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.code, 'INVALID_CREDENTIALS');
});

test('login never creates accounts and rejects registration fields', async () => {
  const { User } = await import('../src/models/index.js');
  const count = await User.countDocuments();
  const unknown = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'not-registered@example.com', password: 'a-secure-password' });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(unknown.headers['set-cookie'], undefined);
  const extraFields = await request(app)
    .post('/api/v1/auth/login')
    .send({
      fullName: 'Stale Registration',
      email: 'trader@example.com',
      password: 'a-secure-password',
    });
  assert.equal(extraFields.status, 400);
  assert.equal(await User.countDocuments(), count);
});
test('private endpoints require a valid access token', async () => {
  assert.equal((await request(app).get('/api/v1/auth/me')).status, 401);
  const res = await request(app).get('/api/v1/auth/me').auth(token, { type: 'bearer' });
  assert.equal(res.body.data.email, 'trader@example.com');
});
test('refresh rotates and reuse revokes the token family', async () => {
  const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
  assert.equal(rotated.status, 200);
  assert.equal((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status, 401);
  assert.equal(
    (
      await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', rotated.headers['set-cookie'][0])
    ).status,
    401,
  );
});
test('untrusted origins are rejected', async () => {
  const res = await request(app).post('/api/v1/auth/refresh').set('Origin', 'https://evil.example');
  assert.equal(res.status, 403);
});
test('registration rejects client-supplied balances', async () => {
  const res = await request(app).post('/api/v1/auth/register').send({
    fullName: 'Attacker',
    email: 'attacker@example.com',
    password: 'valid-password',
    virtualBalance: 99999999,
  });
  assert.equal(res.status, 400);
});
