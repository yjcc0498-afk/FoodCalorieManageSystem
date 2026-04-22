const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
import type { IncomingHttpHeaders, IncomingMessage, Server } from 'node:http';

type JsonObject = Record<string, any>;

type FetchJsonOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
};

type FetchJsonResponse = {
  status: number | undefined;
  headers: IncomingHttpHeaders;
  data: JsonObject;
};

const port = 3111;
const dbName = `food-calorie-db-test-${Date.now()}`;
const mongoUri = `mongodb://127.0.0.1:27017/${dbName}`;
const baseUrl = `http://127.0.0.1:${port}`;

process.env.PORT = String(port);
process.env.MONGODB_URI = mongoUri;
process.env.JWT_SECRET = 'test-secret-value';
process.env.JWT_EXPIRES_IN = '7d';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = '3';
process.env.ADMIN_USERNAME = 'admin_test_runner';
process.env.ADMIN_EMAIL = 'admin_test_runner@example.com';
process.env.ADMIN_PASSWORD = 'AdminPass123';

const { startServer } = require('../server') as {
  startServer: () => Promise<Server>;
};

let serverInstance: Server | undefined;

const fetchJson = async (pathname: string, options: FetchJsonOptions = {}): Promise<FetchJsonResponse> => {
  const url = new URL(pathname, baseUrl);
  const headers = options.headers || {};
  const body = options.body || null;

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: options.method || 'GET',
        headers: {
          ...headers,
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
        }
      },
      (response: IncomingMessage) => {
        let bodyText = '';

        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          bodyText += chunk;
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            headers: response.headers,
            data: bodyText ? JSON.parse(bodyText) : {}
          });
        });
      }
    );

    request.on('error', reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });
};

const registerAndLogin = async (prefix: string) => {
  const suffix = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const username = `${prefix}_${suffix}`.toLowerCase();
  const email = `${username}@example.com`;
  const password = 'UserPass123';

  const registerResponse = await fetchJson('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });

  assert.equal(registerResponse.status, 201);

  const loginResponse = await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: username, password })
  });

  assert.equal(loginResponse.status, 200);

  return {
    username,
    email,
    password,
    token: loginResponse.data.token as string
  };
};

const runStep = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`ok - ${name}`);
};

const cleanup = async () => {
  if (serverInstance) {
    await new Promise<void>((resolve, reject) => {
      serverInstance!.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  await client.db(dbName).dropDatabase();
  await client.close();
};

const main = async () => {
  serverInstance = await startServer();

  await runStep('protected food route rejects missing token with 401', async () => {
    const response = await fetchJson('/foods');

    assert.equal(response.status, 401);
    assert.match(response.data.message, /Authorization token is required/i);
  });

  await runStep('register -> login -> auth/me works end-to-end', async () => {
    const user = await registerAndLogin('flow');
    const response = await fetchJson('/auth/me', {
      headers: {
        Authorization: `Bearer ${user.token}`
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.safeUser.username, user.username);
    assert.equal(response.data.safeUser.email, user.email);
  });

  await runStep('food ownership stays isolated across users', async () => {
    const userA = await registerAndLogin('ownerA');
    const userB = await registerAndLogin('ownerB');

    const createResponse = await fetchJson('/food', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userA.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Owner Isolation Food',
        calories: 250
      })
    });

    assert.equal(createResponse.status, 201);
    const foodId = createResponse.data.data._id;

    const listA = await fetchJson('/foods', {
      headers: {
        Authorization: `Bearer ${userA.token}`
      }
    });

    const listB = await fetchJson('/foods', {
      headers: {
        Authorization: `Bearer ${userB.token}`
      }
    });

    assert.equal(listA.status, 200);
    assert.equal(listB.status, 200);
    assert.equal(listA.data.count, 1);
    assert.equal(listB.data.count, 0);

    const updateByB = await fetchJson(`/food/${foodId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userB.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ calories: 500 })
    });

    const deleteByB = await fetchJson(`/food/${foodId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userB.token}`
      }
    });

    assert.equal(updateByB.status, 404);
    assert.equal(deleteByB.status, 404);
  });

  await runStep('admin route returns 403 for normal users and 200 for admin users', async () => {
    const normalUser = await registerAndLogin('adminGuard');

    const forbiddenResponse = await fetchJson('/users', {
      headers: {
        Authorization: `Bearer ${normalUser.token}`
      }
    });

    assert.equal(forbiddenResponse.status, 403);

    const adminLoginResponse = await fetchJson('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD
      })
    });

    assert.equal(adminLoginResponse.status, 200);

    const adminUsersResponse = await fetchJson('/users', {
      headers: {
        Authorization: `Bearer ${adminLoginResponse.data.token}`
      }
    });

    assert.equal(adminUsersResponse.status, 200);
    assert.ok(adminUsersResponse.data.count >= 1);
  });

  await runStep('login endpoint rate limits repeated failures with 429', async () => {
    const identifier = 'missing-user';
    let lastResponse: FetchJsonResponse | undefined;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      lastResponse = await fetchJson('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          password: 'wrong-password'
        })
      });
    }

    assert.equal(lastResponse?.status, 429);
    assert.match(lastResponse?.data.message, /Too many login attempts/i);
  });
};

main()
  .then(cleanup)
  .catch(async (error: unknown) => {
    console.error(error);
    await cleanup().catch((cleanupError: unknown) => {
      console.error(cleanupError);
    });
    process.exitCode = 1;
  });
