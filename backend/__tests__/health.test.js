'use strict';

// Boot-and-route smoke test. Importing the app via supertest exercises the full
// middleware stack (helmet, cors, json, the route table, the 404 + error
// handlers) without binding a port - app.listen() is guarded by
// `require.main === module`. The Supabase admin client process.exit(1)s on
// missing credentials, so we seed dummy ones; /health never touches Supabase.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.NODE_ENV = 'test';

// expo-server-sdk v6 is ESM-only and the notification service instantiates it at
// module load. /health never sends a push, so stub it out before requiring the
// app (this CommonJS project has no babel-jest, so jest.mock is not hoisted -
// it must run before the require below).
jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken() {
      return true;
    }
    chunkPushNotifications(messages) {
      return [messages];
    }
    async sendPushNotificationsAsync() {
      return [];
    }
  },
}));

const request = require('supertest');
const app = require('../src/server');

describe('GET /health', () => {
  it('returns 200 with an ok status payload', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'bludstack-api' });
    expect(typeof res.body.timestamp).toBe('string');
  });
});

describe('unknown routes', () => {
  it('returns a 404 with a JSON error body', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('protected routes', () => {
  it('rejects an unauthenticated request to a protected endpoint', async () => {
    const res = await request(app).get('/api/v1/requests/my');
    // No bearer token -> the auth middleware must refuse before any controller.
    expect([401, 403]).toContain(res.status);
  });
});
