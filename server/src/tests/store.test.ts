import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';

// Force test environment
process.env.NODE_ENV = 'test';

import {
  createUser,
  findUserByEmail,
  findUserById,
  saveScan,
  getScansForUser,
  getStats,
  deleteUser,
  closeDb,
  getDb,
} from '../store';

describe('Data Store & Repository', () => {
  const TEST_DATA_DIR = path.join(__dirname, '..', 'data-test');

  before(() => {
    const db = getDb();
    db.exec('DELETE FROM scans');
    db.exec('DELETE FROM users');
  });

  after(async () => {
    // Close SQLite database connection first to unlock files
    closeDb();
    
    // Cleanup test data directory after all tests run
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (e) {
      console.warn('Could not clean up test data dir:', e);
    }
  });

  test('should create and retrieve users', async () => {
    const email = 'test-user@healthify.com';
    const user = await createUser('Test User', email, 'hashed-password');

    assert.ok(user.id);
    assert.strictEqual(user.name, 'Test User');
    assert.strictEqual(user.email, email);

    // Retrieve by email
    const fetchedByEmail = await findUserByEmail(email);
    assert.ok(fetchedByEmail);
    assert.strictEqual(fetchedByEmail?.id, user.id);

    // Retrieve by id
    const fetchedById = await findUserById(user.id);
    assert.ok(fetchedById);
    assert.strictEqual(fetchedById?.email, email);
  });

  test('should prevent creating user with duplicate email', async () => {
    const email = 'dup-user@healthify.com';
    await createUser('Dup 1', email, 'hash');
    
    await assert.rejects(
      async () => {
        await createUser('Dup 2', email, 'hash2');
      },
      (err: Error) => err.message === 'Email already registered'
    );
  });

  test('should save scans and compute stats', async () => {
    const user = await createUser('Scan Tester', 'scan-tester@healthify.com', 'pwd');
    const mockReport = {
      ingredients: [
        { ingredient: 'Sugar', severity: 'low' as const, reason: 'high calorie', category: 'sweetener', bans: [], bannedInSelected: false, substitute: null }
      ],
      safetyScore: 90,
      grade: 'A' as const,
      totalCount: 1,
      harmfulCount: 0,
      country: 'India',
      scannedAt: new Date().toISOString(),
    };

    const saved = await saveScan(user.id, user.name, mockReport);
    assert.ok(saved.id);
    assert.strictEqual(saved.userId, user.id);
    assert.strictEqual(saved.report.safetyScore, 90);

    const userScans = await getScansForUser(user.id);
    assert.strictEqual(userScans.length, 1);
    assert.strictEqual(userScans[0].id, saved.id);

    const stats = await getStats();
    assert.ok(stats.totalUsers > 0);
    assert.ok(stats.totalScans > 0);
  });

  test('should delete user and associated scans (GDPR compliance)', async () => {
    const user = await createUser('GDPR User', 'gdpr@healthify.com', 'pwd');
    const mockReport = {
      ingredients: [],
      safetyScore: 100,
      grade: 'A' as const,
      totalCount: 0,
      harmfulCount: 0,
      country: 'India',
      scannedAt: new Date().toISOString(),
    };

    await saveScan(user.id, user.name, mockReport);

    const scansBefore = await getScansForUser(user.id);
    assert.strictEqual(scansBefore.length, 1);

    const deleted = await deleteUser(user.id);
    assert.strictEqual(deleted, true);

    const userAfter = await findUserById(user.id);
    assert.strictEqual(userAfter, undefined);

    const scansAfter = await getScansForUser(user.id);
    assert.strictEqual(scansAfter.length, 0);
  });
});
