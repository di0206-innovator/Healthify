import fs from 'fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { User, UserPublic, StoredScan, ScanReport, AdminStats } from './types';
import { hashPassword } from './auth';
import logger from './utils/logger';

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SCANS_FILE = path.join(DATA_DIR, 'scans.json');

// In-memory cache
let usersCache: User[] | null = null;
let scansCache: StoredScan[] | null = null;

// Write lock (simple promise-based queue)
let usersWritePromise: Promise<void> = Promise.resolve();
let scansWritePromise: Promise<void> = Promise.resolve();

/**
 * Synchronous initialization for directory and seed files.
 */
function ensureDataFiles(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  const defaultAdmin: User = {
    id: crypto.randomUUID(),
    name: 'Admin',
    email: 'admin@healthify.com',
    passwordHash: hashPassword('admin123'),
    role: 'admin',
    createdAt: new Date().toISOString(),
  };

  if (!existsSync(USERS_FILE)) {
    writeFileSync(USERS_FILE, JSON.stringify([defaultAdmin], null, 2));
    logger.info('📦 Created initial users file with default admin: admin@healthify.com / admin123');
  } else {
    // Audit check: ensure at least one admin exists
    try {
      const data = JSON.parse(require('fs').readFileSync(USERS_FILE, 'utf-8'));
      const hasAdmin = Array.isArray(data) && data.some((u: any) => u.role === 'admin');
      if (!hasAdmin) {
        data.push(defaultAdmin);
        writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
        logger.info('📦 Added missing default admin account.');
      }
    } catch (e) {
      logger.error('⚠️ Could not audit users file, resetting to default admin.');
      writeFileSync(USERS_FILE, JSON.stringify([defaultAdmin], null, 2));
    }
  }

  if (!existsSync(SCANS_FILE)) {
    writeFileSync(SCANS_FILE, JSON.stringify([], null, 2));
  }
}

ensureDataFiles();

// ---------- Internal Helpers ----------

async function getOrLoadUsers(): Promise<User[]> {
  if (usersCache) return usersCache;
  try {
    const data = await fs.readFile(USERS_FILE, 'utf-8');
    usersCache = JSON.parse(data);
    return usersCache || [];
  } catch {
    usersCache = [];
    return [];
  }
}

async function getOrLoadScans(): Promise<StoredScan[]> {
  if (scansCache) return scansCache;
  try {
    const data = await fs.readFile(SCANS_FILE, 'utf-8');
    scansCache = JSON.parse(data);
    return scansCache || [];
  } catch {
    scansCache = [];
    return [];
  }
}

async function persistUsers(users: User[]): Promise<void> {
  usersCache = users;
  usersWritePromise = usersWritePromise.then(async () => {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  });
  return usersWritePromise;
}

async function persistScans(scans: StoredScan[]): Promise<void> {
  scansCache = scans;
  scansWritePromise = scansWritePromise.then(async () => {
    await fs.writeFile(SCANS_FILE, JSON.stringify(scans, null, 2));
  });
  return scansWritePromise;
}

// ---------- User Store ----------

export function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const users = await getOrLoadUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function findUserById(id: string): Promise<User | undefined> {
  const users = await getOrLoadUsers();
  return users.find((u) => u.id === id);
}

export async function createUser(name: string, email: string, passwordHash: string): Promise<User> {
  const users = await getOrLoadUsers();

  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Email already registered');
  }

  const user: User = {
    id: crypto.randomUUID(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await persistUsers(users);
  logger.info('User created', { userId: user.id, email: user.email });
  return user;
}

export async function getAllUsers(): Promise<UserPublic[]> {
  const users = await getOrLoadUsers();
  return users.map(toPublicUser);
}

/**
 * Get paginated users list.
 */
export async function getPaginatedUsers(page: number = 1, limit: number = 50): Promise<{
  data: UserPublic[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const users = await getOrLoadUsers();
  const total = users.length;
  const pages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = users.slice(offset, offset + limit).map(toPublicUser);

  return { data, pagination: { page, limit, total, pages } };
}

// ---------- Scan Store ----------

export async function saveScan(userId: string, userName: string, report: ScanReport): Promise<StoredScan> {
  const scans = await getOrLoadScans();
  const storedScan: StoredScan = {
    id: crypto.randomUUID(),
    userId,
    userName,
    report: { ...report, id: crypto.randomUUID(), userId },
    createdAt: new Date().toISOString(),
  };
  scans.unshift(storedScan);
  if (scans.length > 500) scans.length = 500;
  await persistScans(scans);
  logger.info('Scan saved', { scanId: storedScan.id, userId, score: report.safetyScore, grade: report.grade });
  return storedScan;
}

export async function getScansForUser(userId: string): Promise<StoredScan[]> {
  const scans = await getOrLoadScans();
  return scans.filter((s) => s.userId === userId);
}

export async function getAllScans(): Promise<StoredScan[]> {
  return await getOrLoadScans();
}

/**
 * Get paginated scans list.
 */
export async function getPaginatedScans(page: number = 1, limit: number = 50): Promise<{
  data: StoredScan[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const scans = await getOrLoadScans();
  const total = scans.length;
  const pages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = scans.slice(offset, offset + limit);

  return { data, pagination: { page, limit, total, pages } };
}

export async function getScanById(scanId: string): Promise<StoredScan | undefined> {
  const scans = await getOrLoadScans();
  return scans.find((s) => s.id === scanId || s.report.id === scanId);
}

// ---------- GDPR: Data Export ----------

export async function getUserDataExport(userId: string): Promise<{
  user: UserPublic;
  scans: StoredScan[];
  exportedAt: string;
} | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  const userScans = await getScansForUser(userId);

  return {
    user: toPublicUser(user),
    scans: userScans,
    exportedAt: new Date().toISOString(),
  };
}

// ---------- GDPR: Account Deletion ----------

export async function deleteUser(userId: string): Promise<boolean> {
  const users = await getOrLoadUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) return false;

  const deletedEmail = users[index].email;
  users.splice(index, 1);
  await persistUsers(users);

  // Also delete all user scans
  const scans = await getOrLoadScans();
  const filtered = scans.filter((s) => s.userId !== userId);
  await persistScans(filtered);

  logger.info('User account deleted (GDPR)', { userId, email: deletedEmail, scansRemoved: scans.length - filtered.length });
  return true;
}

// ---------- Admin Stats ----------

export async function getStats(): Promise<AdminStats> {
  const users = await getOrLoadUsers();
  const scans = await getOrLoadScans();

  const scores = scans.map((s) => s.report.safetyScore);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const gradeDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scans.forEach((s) => {
    gradeDistribution[s.report.grade] = (gradeDistribution[s.report.grade] || 0) + 1;
  });

  return {
    totalUsers: users.length,
    totalScans: scans.length,
    avgScore,
    gradeDistribution,
  };
}
