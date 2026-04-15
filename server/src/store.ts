import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { User, UserPublic, StoredScan, ScanReport, AdminStats } from './types';
import { hashPassword } from './auth';

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SCANS_FILE = path.join(DATA_DIR, 'scans.json');

// Ensure data directory and files exist
function ensureDataFiles(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    // Seed with a default admin user
    const adminUser: User = {
      id: crypto.randomUUID(),
      name: 'Admin',
      email: 'admin@healthify.com',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify([adminUser], null, 2));
    console.log('📦 Created default admin: admin@healthify.com / admin123');
  }
  if (!fs.existsSync(SCANS_FILE)) {
    fs.writeFileSync(SCANS_FILE, JSON.stringify([], null, 2));
  }
}

ensureDataFiles();

// ---------- User Store ----------

function readUsers(): User[] {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeUsers(users: User[]): void {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function findUserByEmail(email: string): User | undefined {
  return readUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): User | undefined {
  return readUsers().find((u) => u.id === id);
}

export function createUser(name: string, email: string, passwordHash: string): User {
  const users = readUsers();

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
  writeUsers(users);
  return user;
}

export function getAllUsers(): UserPublic[] {
  return readUsers().map(toPublicUser);
}

// ---------- Scan Store ----------

function readScans(): StoredScan[] {
  try {
    return JSON.parse(fs.readFileSync(SCANS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeScans(scans: StoredScan[]): void {
  fs.writeFileSync(SCANS_FILE, JSON.stringify(scans, null, 2));
}

export function saveScan(userId: string, userName: string, report: ScanReport): StoredScan {
  const scans = readScans();
  const storedScan: StoredScan = {
    id: crypto.randomUUID(),
    userId,
    userName,
    report: { ...report, id: crypto.randomUUID(), userId },
    createdAt: new Date().toISOString(),
  };
  scans.unshift(storedScan); // newest first
  // Keep max 500 scans
  if (scans.length > 500) scans.length = 500;
  writeScans(scans);
  return storedScan;
}

export function getScansForUser(userId: string): StoredScan[] {
  return readScans().filter((s) => s.userId === userId);
}

export function getAllScans(): StoredScan[] {
  return readScans();
}

export function getScanById(scanId: string): StoredScan | undefined {
  return readScans().find((s) => s.id === scanId || s.report.id === scanId);
}

// ---------- Admin Stats ----------

export function getStats(): AdminStats {
  const users = readUsers();
  const scans = readScans();

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
