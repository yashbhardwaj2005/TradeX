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
test('registration initializes virtual funds and hides credentials', async () => {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName: 'Test Trader', email: 'trader@example.com', password: 'a-secure-password' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.virtualBalance, 100000000);
  assert.equal(res.body.data.user.passwordHash, undefined);
  token = res.body.data.accessToken;
  cookie = res.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
});
test('login verifies password', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'trader@example.com', password: 'a-secure-password' });
  assert.equal(res.status, 200);
  const bad = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'trader@example.com', password: 'wrong-password' });
  assert.equal(bad.status, 401);
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
