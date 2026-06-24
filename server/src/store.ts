import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { User, UserPublic, StoredScan, ScanReport, AdminStats } from './types';
import { hashPasswordSync } from './auth';
import logger from './utils/logger';

const isTest = process.env.NODE_ENV === 'test';
const isVercel = process.env.VERCEL === '1';
const DATA_DIR = isTest
  ? path.normalize(path.join(__dirname, '..', 'data-test'))
  : isVercel
    ? '/tmp'
    : path.normalize(path.join(__dirname, '..', 'data'));

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.normalize(path.join(DATA_DIR, 'healthify.db'));

// Validate path
if (!DB_FILE.startsWith(DATA_DIR)) {
  throw new Error('Directory traversal attempt detected');
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  dbInstance = new DatabaseSync(DB_FILE);

  // WAL mode for parallel concurrent reads/writes; synchronous NORMAL to avoid disk flush blocking
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA synchronous = NORMAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');

  // Table Schemas
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      country TEXT NOT NULL,
      safetyScore INTEGER NOT NULL,
      grade TEXT NOT NULL,
      totalCount INTEGER NOT NULL,
      harmfulCount INTEGER NOT NULL,
      scannedAt TEXT NOT NULL,
      inputText TEXT NOT NULL,
      reportJson TEXT NOT NULL,
      inputHash TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Index optimization
  dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
  dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(userId);');
  dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_scans_input_hash ON scans(inputHash, country);');

  return dbInstance;
}

/**
 * Normalizes ingredients text and hashes it using SHA-256 for caching
 */
export function getIngredientsHash(inputText: string): string {
  const normalized = inputText
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(',');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Synchronous initialization to seed defaults.
 */
export function ensureDataFiles(): void {
  const db = getDb();
  
  const checkAdmin = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin') as any;
  if (!checkAdmin) {
    const adminId = crypto.randomUUID();
    const passwordHash = hashPasswordSync('admin123');
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, name, email, passwordHash, role, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(adminId, 'Admin', 'admin@healthify.com', passwordHash, 'admin', createdAt);

    logger.info('📦 SQLite: Seeded default admin account (admin@healthify.com / admin123)');
  }
}

// Initialize database
ensureDataFiles();

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
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role as any,
    createdAt: row.createdAt,
  };
}

export async function findUserById(id: string): Promise<User | undefined> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role as any,
    createdAt: row.createdAt,
  };
}

export async function createUser(name: string, email: string, passwordHash: string): Promise<User> {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
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

  db.prepare(`
    INSERT INTO users (id, name, email, passwordHash, role, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.id, user.name, user.email, user.passwordHash, user.role, user.createdAt);

  logger.info('User created', { userId: user.id, email: user.email });
  return user;
}

export async function getAllUsers(): Promise<UserPublic[]> {
  const db = getDb();
  const rows = db.prepare('SELECT id, name, email, role, createdAt FROM users').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    createdAt: r.createdAt,
  }));
}

export async function getPaginatedUsers(page: number = 1, limit: number = 50): Promise<{
  data: UserPublic[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const db = getDb();
  const totalRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  const total = totalRow.count;
  const pages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  const rows = db.prepare('SELECT id, name, email, role, createdAt FROM users LIMIT ? OFFSET ?').all(limit, offset) as any[];
  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    createdAt: r.createdAt,
  }));

  return { data, pagination: { page, limit, total, pages } };
}

// ---------- Scan Store ----------

export async function saveScan(userId: string, userName: string, report: ScanReport): Promise<StoredScan> {
  const db = getDb();
  const id = crypto.randomUUID();
  const reportId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const finalReport: ScanReport = {
    ...report,
    id: reportId,
    userId,
  };

  const inputText = report.inputText || '';
  const inputHash = getIngredientsHash(inputText);

  db.prepare(`
    INSERT INTO scans (id, userId, userName, country, safetyScore, grade, totalCount, harmfulCount, scannedAt, inputText, reportJson, inputHash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    userName,
    finalReport.country,
    finalReport.safetyScore,
    finalReport.grade,
    finalReport.totalCount,
    finalReport.harmfulCount,
    finalReport.scannedAt,
    inputText,
    JSON.stringify(finalReport),
    inputHash
  );

  // Prune history to preserve space if exceeding 500 scans
  const countRow = db.prepare('SELECT COUNT(*) as count FROM scans').get() as any;
  if (countRow.count > 500) {
    db.prepare(`
      DELETE FROM scans WHERE id IN (
        SELECT id FROM scans ORDER BY scannedAt ASC LIMIT ?
      )
    `).run(countRow.count - 500);
  }

  logger.info('Scan saved', { scanId: id, userId, score: report.safetyScore, grade: report.grade });

  return {
    id,
    userId,
    userName,
    report: finalReport,
    createdAt,
  };
}

/**
 * Check cache for an existing scan matching normalized ingredients hash and target country.
 */
export async function findCachedScanReport(inputText: string, country: string): Promise<ScanReport | null> {
  const db = getDb();
  const hash = getIngredientsHash(inputText);
  const row = db.prepare('SELECT reportJson FROM scans WHERE inputHash = ? AND country = ? ORDER BY scannedAt DESC LIMIT 1').get(hash, country) as any;
  
  if (!row) return null;

  try {
    const report = JSON.parse(row.reportJson) as ScanReport;
    return {
      ...report,
      scannedAt: new Date().toISOString(), // Update timestamp to current request time
    };
  } catch {
    return null;
  }
}

export async function getScansForUser(userId: string): Promise<StoredScan[]> {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM scans WHERE userId = ? ORDER BY scannedAt DESC').all(userId) as any[];
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    report: JSON.parse(r.reportJson),
    createdAt: r.scannedAt,
  }));
}

export async function getAllScans(): Promise<StoredScan[]> {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM scans ORDER BY scannedAt DESC').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    report: JSON.parse(r.reportJson),
    createdAt: r.scannedAt,
  }));
}

export async function getPaginatedScans(page: number = 1, limit: number = 50): Promise<{
  data: StoredScan[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const db = getDb();
  const totalRow = db.prepare('SELECT COUNT(*) as count FROM scans').get() as any;
  const total = totalRow.count;
  const pages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  const rows = db.prepare('SELECT * FROM scans ORDER BY scannedAt DESC LIMIT ? OFFSET ?').all(limit, offset) as any[];
  const data = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    report: JSON.parse(r.reportJson),
    createdAt: r.scannedAt,
  }));

  return { data, pagination: { page, limit, total, pages } };
}

export async function getScanById(scanId: string): Promise<StoredScan | undefined> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM scans WHERE id = ? OR json_extract(reportJson, "$.id") = ?').get(scanId, scanId) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    report: JSON.parse(row.reportJson),
    createdAt: row.scannedAt,
  };
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
  const db = getDb();
  const user = await findUserById(userId);
  if (!user) return false;

  // SQLite foreign key ON DELETE CASCADE handles deleting related scans automatically
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  logger.info('User account deleted (GDPR)', { userId, email: user.email });
  return true;
}

// ---------- Admin Stats ----------

export async function getStats(): Promise<AdminStats> {
  const db = getDb();
  const totalUsersRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  const totalScansRow = db.prepare('SELECT COUNT(*) as count, AVG(safetyScore) as avgScore FROM scans').get() as any;

  const totalUsers = totalUsersRow.count;
  const totalScans = totalScansRow.count;
  const avgScore = totalScans > 0 ? Math.round(totalScansRow.avgScore) : 0;

  const gradeDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const rows = db.prepare('SELECT grade, COUNT(*) as count FROM scans GROUP BY grade').all() as any[];
  rows.forEach((r) => {
    if (r.grade in gradeDistribution) {
      gradeDistribution[r.grade] = r.count;
    }
  });

  return {
    totalUsers,
    totalScans,
    avgScore,
    gradeDistribution,
  };
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
