import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import request from 'supertest';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1/test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters';
process.env.WORKER_ENABLED = 'true';
let replica;
export async function setup() {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const { connectDatabase } = await import('../src/config/database.js');
  await connectDatabase(replica.getUri());
  const { initializeModels } = await import('../src/models/index.js');
  await initializeModels();
  const { app, finishRoutes } = await import('../src/app.js');
  finishRoutes();
  return app;
}
export async function teardown() {
  await mongoose.disconnect();
  await replica?.stop();
}
export async function registerAndLogin(app, input) {
  const registered = await request(app).post('/api/v1/auth/register').send(input);
  assert.equal(registered.status, 201);
  const loggedIn = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: input.email, password: input.password });
  assert.equal(loggedIn.status, 200);
  return loggedIn;
}
