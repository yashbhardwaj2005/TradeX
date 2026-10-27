import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import 'dotenv/config';
const dbPath = path.resolve('.data/mongodb');
await mkdir(dbPath, { recursive: true });
const port = Number(process.env.LOCAL_MONGO_PORT || 27018);
const replica = await MongoMemoryServer.create({
  instance: { dbPath, port, replSet: 'testset', storageEngine: 'wiredTiger', ip: '127.0.0.1' },
});
const client = new mongoose.mongo.MongoClient(replica.getUri(), {
  directConnection: true,
  connectTimeoutMS: 120000,
  serverSelectionTimeoutMS: 120000,
  socketTimeoutMS: 120000,
});
try {
  await client.connect();
  const admin = client.db('admin');
  // Read persisted configuration first; issuing initiate during recovery can
  // stall while MongoDB tries to contact an old development port.
  const config = await client.db('local').collection('system.replset').findOne();
  if (!config) {
    await admin.command({
      replSetInitiate: { _id: 'testset', members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });
  } else if (config.members[0].host !== `127.0.0.1:${port}`) {
    // A persisted member first checks its old host. Wait for that startup check
    // before force-reconfiguring this development-only, single-node set.
    const recoveryDeadline = Date.now() + 120000;
    for (;;) {
      try {
        await admin.command({ replSetGetConfig: 1 });
        break;
      } catch (error) {
        if (error.code !== 94 || Date.now() >= recoveryDeadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    config.members = [{ _id: 0, host: `127.0.0.1:${port}` }];
    config.version++;
    await admin.command({ replSetReconfig: config, force: true });
  }
  const deadline = Date.now() + 30000;
  let primary = false;
  while (Date.now() < deadline) {
    if ((await admin.command({ hello: 1 })).isWritablePrimary) {
      primary = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!primary) throw new Error('Local MongoDB did not elect a primary within 30 seconds.');
} catch (error) {
  await replica.stop({ doCleanup: false });
  throw error;
} finally {
  await client.close();
}
process.env.MONGODB_URI = `${replica.getUri('tradeforge')}?replicaSet=testset`;
process.env.JWT_ACCESS_SECRET ||= randomBytes(48).toString('hex');
process.env.JWT_REFRESH_SECRET ||= randomBytes(48).toString('hex');
console.log(
  'Local persistent MongoDB replica set started. Development auth secrets are ephemeral.',
);
// Keep MongoDB in the parent process so API file watching never restarts the DB.
const child = spawn(process.execPath, ['--watch', 'src/index.js'], {
  stdio: 'inherit',
  env: process.env,
  windowsHide: true,
});
let closing = false;
async function close(code = 0) {
  if (closing) return;
  closing = true;
  child.kill();
  await replica.stop({ doCleanup: false });
  process.exit(code);
}
child.on('exit', (code) => close(code || 0));
process.on('SIGINT', () => close());
process.on('SIGTERM', () => close());
