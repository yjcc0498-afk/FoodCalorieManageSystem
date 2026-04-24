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

const createFood = async (token: string, payload: { name: string; calories?: number }) => {
  return fetchJson('/food', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
};

const createGoalCycle = async (
  token: string,
  payload: {
    startDate: string;
    endDate: string;
    startWeight: number;
    targetWeight: number;
    dailyCalorieGoal: number;
  }
) => {
  return fetchJson('/goals/cycle', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
};

const upsertDailyLog = async (
  token: string,
  date: string,
  payload: { weight?: number | null; notes?: string | null }
) => {
  return fetchJson(`/daily-log?date=${encodeURIComponent(date)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
};

const createJournalEntry = async (
  token: string,
  payload: {
    date: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    foodName: string;
    calories: number;
    quantity?: number;
    notes?: string | null;
    foodId?: string;
  }
) => {
  return fetchJson('/journal', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
};

const getCollection = (name: string) => {
  const database = mongoose.connection.db;

  if (!database) {
    throw new Error('MongoDB database connection is not ready.');
  }

  return database.collection(name);
};

const loginAsAdmin = async () => {
  const adminLoginResponse = await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD
    })
  });

  assert.equal(adminLoginResponse.status, 200);
  return adminLoginResponse.data.token as string;
};

const withEnv = async (entries: Record<string, string>, callback: () => Promise<void>) => {
  const previousValues = new Map<string, string | undefined>();

  Object.entries(entries).forEach(([key, value]) => {
    previousValues.set(key, process.env[key]);
    process.env[key] = value;
  });

  try {
    await callback();
  } finally {
    previousValues.forEach((value, key) => {
      if (value === undefined) {
        delete process.env[key];
        return;
      }

      process.env[key] = value;
    });
  }
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

  await runStep('admin bootstrap never promotes a regular user on config conflict', async () => {
    const User = require('../models/User');
    const { ensureAdminUser } = require('../config/bootstrapAdmin') as {
      ensureAdminUser: () => Promise<any>;
    };
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const username = `conflict_${suffix}`.toLowerCase();
    const email = `${username}@example.com`;
    const password = 'UserPass123';

    const regularUser = await User.create({
      username,
      email,
      password
    });

    await withEnv(
      {
        ADMIN_USERNAME: username,
        ADMIN_EMAIL: `admin-conflict-${suffix}@example.com`,
        ADMIN_PASSWORD: 'OtherAdminPass123'
      },
      async () => {
        const bootstrappedUser = await ensureAdminUser();
        assert.equal(bootstrappedUser, null);
      }
    );

    const storedUser = await User.findById(regularUser._id).select('+password');
    assert.ok(storedUser);
    assert.equal(storedUser.role, 'user');
    assert.equal(storedUser.username, username);
    assert.equal(storedUser.email, email);

    const loginResponse = await fetchJson('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: username,
        password
      })
    });

    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.data.safeUser.role, 'user');
  });

  await runStep('food ownership stays isolated across users', async () => {
    const userA = await registerAndLogin('ownerA');
    const userB = await registerAndLogin('ownerB');

    const createResponse = await createFood(userA.token, {
      name: 'Owner Isolation Food',
      calories: 250
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
    assert.equal(listA.data.pagination.total, 1);
    assert.equal(listB.data.pagination.total, 0);
    assert.equal(listA.data.pagination.page, 1);
    assert.equal(listB.data.pagination.page, 1);

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

  await runStep('food list supports pagination, filters, sorting, and owner isolation', async () => {
    const userA = await registerAndLogin('listA');
    const userB = await registerAndLogin('listB');

    const foodsForUserA = [
      { name: 'Chicken Curry', calories: 220 },
      { name: 'Chicken Wrap', calories: 180 },
      { name: 'Grilled Chicken', calories: 120 },
      { name: 'Garden Salad', calories: 80 }
    ];

    for (const food of foodsForUserA) {
      const response = await createFood(userA.token, food);
      assert.equal(response.status, 201);
    }

    const userBFoodResponse = await createFood(userB.token, {
      name: 'Chicken Secret',
      calories: 200
    });
    assert.equal(userBFoodResponse.status, 201);

    const filteredPageOne = await fetchJson(
      '/foods?keyword=chicken&caloriesMin=100&caloriesMax=250&sortBy=calories&order=desc&page=1&limit=2',
      {
        headers: {
          Authorization: `Bearer ${userA.token}`
        }
      }
    );

    assert.equal(filteredPageOne.status, 200);
    assert.equal(filteredPageOne.data.count, 2);
    assert.equal(filteredPageOne.data.pagination.page, 1);
    assert.equal(filteredPageOne.data.pagination.limit, 2);
    assert.equal(filteredPageOne.data.pagination.total, 3);
    assert.equal(filteredPageOne.data.pagination.totalPages, 2);
    assert.equal(filteredPageOne.data.pagination.hasNextPage, true);
    assert.equal(filteredPageOne.data.pagination.hasPrevPage, false);
    assert.deepEqual(
      filteredPageOne.data.data.map((food: JsonObject) => food.calories),
      [220, 180]
    );
    assert.deepEqual(
      filteredPageOne.data.data.map((food: JsonObject) => food.name),
      ['chicken curry', 'chicken wrap']
    );

    const filteredPageTwo = await fetchJson(
      '/foods?keyword=chicken&caloriesMin=100&caloriesMax=250&sortBy=calories&order=desc&page=2&limit=2',
      {
        headers: {
          Authorization: `Bearer ${userA.token}`
        }
      }
    );

    assert.equal(filteredPageTwo.status, 200);
    assert.equal(filteredPageTwo.data.count, 1);
    assert.equal(filteredPageTwo.data.pagination.page, 2);
    assert.equal(filteredPageTwo.data.pagination.limit, 2);
    assert.equal(filteredPageTwo.data.pagination.total, 3);
    assert.equal(filteredPageTwo.data.pagination.totalPages, 2);
    assert.equal(filteredPageTwo.data.pagination.hasNextPage, false);
    assert.equal(filteredPageTwo.data.pagination.hasPrevPage, true);
    assert.deepEqual(
      filteredPageTwo.data.data.map((food: JsonObject) => food.name),
      ['grilled chicken']
    );

    const userBFilteredList = await fetchJson('/foods?keyword=chicken&caloriesMin=100&caloriesMax=250', {
      headers: {
        Authorization: `Bearer ${userB.token}`
      }
    });

    assert.equal(userBFilteredList.status, 200);
    assert.equal(userBFilteredList.data.count, 1);
    assert.equal(userBFilteredList.data.pagination.total, 1);
    assert.deepEqual(
      userBFilteredList.data.data.map((food: JsonObject) => food.name),
      ['chicken secret']
    );
  });

  await runStep('admin route returns 403 for normal users and 200 for admin users', async () => {
    const normalUser = await registerAndLogin('adminGuard');

    const forbiddenResponse = await fetchJson('/users', {
      headers: {
        Authorization: `Bearer ${normalUser.token}`
      }
    });

    assert.equal(forbiddenResponse.status, 403);

    const adminToken = await loginAsAdmin();

    const adminUsersResponse = await fetchJson('/users', {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(adminUsersResponse.status, 200);
    assert.ok(adminUsersResponse.data.count >= 1);
  });

  await runStep('admin overview returns masked security and system summaries', async () => {
    const overviewUser = await registerAndLogin('overviewUser');
    const createResponse = await createFood(overviewUser.token, {
      name: 'Overview Food',
      calories: 310
    });

    assert.equal(createResponse.status, 201);

    const adminToken = await loginAsAdmin();
    const overviewResponse = await fetchJson('/admin/overview', {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(overviewResponse.status, 200);
    assert.equal(overviewResponse.data.message, 'Admin overview fetched successfully.');

    const overview = overviewResponse.data.data;

    assert.equal(typeof overview.counts.totalUsers, 'number');
    assert.equal(overview.security.loginRateLimitWindowMs, 60000);
    assert.equal(overview.security.loginRateLimitMaxAttempts, 3);
    assert.equal(overview.security.jwtExpiresIn, '7d');
    assert.match(overview.security.auditStatus, /summary-only/i);
    assert.equal(overview.system.runtime, 'Node.js + Express 5');
    assert.equal(overview.system.odm, 'Mongoose');
    assert.equal(overview.system.auth, 'JWT + bcryptjs');
    assert.equal(overview.system.adminBootstrapEnabled, true);
    assert.equal(overview.system.envSource, '.env / process.env');
    assert.equal(overview.health.apiReady, true);
    assert.equal(overview.health.mongoExpectedLocal, true);
    assert.equal(overview.health.adminBootstrapEnabled, true);
    assert.equal(overview.health.demoVersion, 'Food Calorie Management System v3');
    assert.ok(Array.isArray(overview.recentActivity));
    assert.ok(overview.recentActivity.length >= 1);
    assert.ok(
      overview.recentActivity.some((item: JsonObject) => ['user_registered', 'food_created', 'user_login'].includes(item.type))
    );

    const serializedOverview = JSON.stringify(overview);
    assert.doesNotMatch(serializedOverview, /test-secret-value/i);
    assert.doesNotMatch(serializedOverview, /AdminPass123/i);
    assert.doesNotMatch(serializedOverview, /mongodb:\/\/127\.0\.0\.1:27017\//i);
    assert.equal('secret' in overview.security, false);
    assert.equal('password' in overview.system, false);
  });

  await runStep('goal cycle creation exposes active cycle and archives previous active cycle', async () => {
    const user = await registerAndLogin('goalCycle');

    const firstCycleResponse = await createGoalCycle(user.token, {
      startDate: '2026-04-24',
      endDate: '2026-06-24',
      startWeight: 64.8,
      targetWeight: 61.5,
      dailyCalorieGoal: 1750
    });

    assert.equal(firstCycleResponse.status, 201);
    assert.equal(firstCycleResponse.data.data.status, 'active');
    assert.equal(firstCycleResponse.data.data.dailyCalorieGoal, 1750);

    const secondCycleResponse = await createGoalCycle(user.token, {
      startDate: '2026-05-01',
      endDate: '2026-07-01',
      startWeight: 64.2,
      targetWeight: 60.8,
      dailyCalorieGoal: 1650
    });

    assert.equal(secondCycleResponse.status, 201);
    assert.equal(secondCycleResponse.data.data.status, 'active');

    const activeCycleResponse = await fetchJson('/goals/active', {
      headers: {
        Authorization: `Bearer ${user.token}`
      }
    });

    assert.equal(activeCycleResponse.status, 200);
    assert.equal(activeCycleResponse.data.data._id, secondCycleResponse.data.data._id);
    assert.equal(activeCycleResponse.data.data.dailyCalorieGoal, 1650);

    const goalCycles = await getCollection('goalcycles')
      .find({ owner: new mongoose.Types.ObjectId(String(firstCycleResponse.data.data.owner)) })
      .sort({ createdAt: 1 })
      .toArray();

    assert.equal(goalCycles.length, 2);
    assert.equal(goalCycles.filter((item: JsonObject) => item.status === 'active').length, 1);
    assert.equal(goalCycles[0].status, 'archived');
    assert.equal(goalCycles[1].status, 'active');
  });

  await runStep('daily log upsert keeps a single record per owner and date', async () => {
    const user = await registerAndLogin('dailyLog');
    const date = '2026-04-24';

    const firstSaveResponse = await upsertDailyLog(user.token, date, {
      weight: 64.5,
      notes: 'Morning weigh-in'
    });

    assert.equal(firstSaveResponse.status, 200);
    assert.equal(firstSaveResponse.data.data.weight, 64.5);
    assert.equal(firstSaveResponse.data.data.notes, 'Morning weigh-in');

    const secondSaveResponse = await upsertDailyLog(user.token, date, {
      weight: 64.1,
      notes: 'Updated after workout'
    });

    assert.equal(secondSaveResponse.status, 200);
    assert.equal(secondSaveResponse.data.data._id, firstSaveResponse.data.data._id);
    assert.equal(secondSaveResponse.data.data.weight, 64.1);
    assert.equal(secondSaveResponse.data.data.notes, 'Updated after workout');

    const fetchedDailyLogResponse = await fetchJson(`/daily-log?date=${date}`, {
      headers: {
        Authorization: `Bearer ${user.token}`
      }
    });

    assert.equal(fetchedDailyLogResponse.status, 200);
    assert.equal(fetchedDailyLogResponse.data.data._id, firstSaveResponse.data.data._id);
    assert.equal(fetchedDailyLogResponse.data.data.weight, 64.1);

    const dailyLogs = await getCollection('dailylogs')
      .find({ owner: new mongoose.Types.ObjectId(String(firstSaveResponse.data.data.owner)) })
      .toArray();

    assert.equal(dailyLogs.length, 1);
  });

  await runStep('journal entry ownership stays isolated across users', async () => {
    const userA = await registerAndLogin('journalOwnerA');
    const userB = await registerAndLogin('journalOwnerB');
    const date = '2026-04-24';

    const createResponse = await createJournalEntry(userA.token, {
      date,
      mealType: 'lunch',
      foodName: 'Chicken Bowl',
      calories: 560,
      quantity: 1
    });

    assert.equal(createResponse.status, 201);
    const entryId = createResponse.data.data._id;

    const ownListResponse = await fetchJson(`/journal?date=${date}`, {
      headers: {
        Authorization: `Bearer ${userA.token}`
      }
    });
    const foreignListResponse = await fetchJson(`/journal?date=${date}`, {
      headers: {
        Authorization: `Bearer ${userB.token}`
      }
    });

    assert.equal(ownListResponse.status, 200);
    assert.equal(ownListResponse.data.count, 1);
    assert.equal(foreignListResponse.status, 200);
    assert.equal(foreignListResponse.data.count, 0);

    const updateByOtherUser = await fetchJson(`/journal/${entryId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userB.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ calories: 700 })
    });

    const deleteByOtherUser = await fetchJson(`/journal/${entryId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userB.token}`
      }
    });

    assert.equal(updateByOtherUser.status, 404);
    assert.equal(deleteByOtherUser.status, 404);
  });

  await runStep('goal day summary aggregates journal calories for the selected date', async () => {
    const user = await registerAndLogin('goalDay');
    const date = '2026-04-24';
    const month = '2026-04';

    const goalCycleResponse = await createGoalCycle(user.token, {
      startDate: '2026-04-20',
      endDate: '2026-06-20',
      startWeight: 64.8,
      targetWeight: 61.5,
      dailyCalorieGoal: 1800
    });

    assert.equal(goalCycleResponse.status, 201);

    const dailyLogResponse = await upsertDailyLog(user.token, date, {
      weight: 64.0,
      notes: 'Steady progress'
    });

    assert.equal(dailyLogResponse.status, 200);

    const breakfastEntry = await createJournalEntry(user.token, {
      date,
      mealType: 'breakfast',
      foodName: 'Greek Yogurt',
      calories: 500,
      quantity: 1
    });
    const dinnerEntry = await createJournalEntry(user.token, {
      date,
      mealType: 'dinner',
      foodName: 'Salmon Rice Bowl',
      calories: 650,
      quantity: 1
    });
    const otherDayEntry = await createJournalEntry(user.token, {
      date: '2026-04-25',
      mealType: 'snack',
      foodName: 'Protein Bar',
      calories: 220,
      quantity: 1
    });

    assert.equal(breakfastEntry.status, 201);
    assert.equal(dinnerEntry.status, 201);
    assert.equal(otherDayEntry.status, 201);

    const summaryResponse = await fetchJson(`/goals/day?date=${date}&month=${month}`, {
      headers: {
        Authorization: `Bearer ${user.token}`
      }
    });

    assert.equal(summaryResponse.status, 200);
    assert.equal(summaryResponse.data.data.date, date);
    assert.equal(summaryResponse.data.data.goalCycle._id, goalCycleResponse.data.data._id);
    assert.equal(summaryResponse.data.data.dailyLog._id, dailyLogResponse.data.data._id);
    assert.equal(summaryResponse.data.data.journalEntries.length, 2);
    assert.equal(summaryResponse.data.data.summary.actualCalories, 1150);
    assert.equal(summaryResponse.data.data.summary.targetCalories, 1800);
    assert.equal(summaryResponse.data.data.summary.remainingCalories, 650);
    assert.equal(summaryResponse.data.data.summary.weightProgress.actualWeight, 64);
    assert.equal(summaryResponse.data.data.summary.weightProgress.actualProgressRatio, 0.2424);

    const selectedDayIndicator = summaryResponse.data.data.monthIndicators.find(
      (item: JsonObject) => item.date === date
    );

    assert.ok(selectedDayIndicator);
    assert.equal(selectedDayIndicator.hasDailyLog, true);
    assert.equal(selectedDayIndicator.hasJournalEntries, true);
    assert.equal(selectedDayIndicator.actualCalories, 1150);
    assert.equal(selectedDayIndicator.overGoal, false);
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
