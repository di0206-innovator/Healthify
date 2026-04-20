import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { AuthPayload } from './types';
import logger from './utils/logger';
import { Errors } from './utils/errors';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set');
}

if (JWT_SECRET.length < 32) {
  logger.warn('JWT_SECRET is shorter than 32 characters. This is insecure for production.');
}

const SECRET = JWT_SECRET;
const REFRESH_SECRET = JWT_SECRET + ':refresh'; // Derived refresh secret
const ACCESS_TOKEN_EXPIRY = '15m';   // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '7d';   // Long-lived refresh token
const PBKDF2_ITERATIONS = 210000;

/**
 * Hash a password using PBKDF2 (no external deps needed)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const verify = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return hash === verify;
}

/**
 * Generate both access and refresh tokens.
 */
export function generateTokens(payload: AuthPayload): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign(payload, SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId: payload.userId }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

/**
 * Legacy single-token generation (for backward compatibility during rollout).
 */
export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY }); // Keep 7d for legacy clients
}

/**
 * Verify and decode an access JWT token.
 */
export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, SECRET) as AuthPayload;
}

/**
 * Verify a refresh token and return a new access token.
 */
export function refreshAccessToken(refreshToken: string, userLookup: (userId: string) => Promise<AuthPayload | null>): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { userId: string };
      const user = await userLookup(decoded.userId);
      if (!user) {
        return reject(Errors.TOKEN_INVALID());
      }
      const newAccessToken = jwt.sign(
        { userId: user.userId, email: user.email, role: user.role },
        SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );
      resolve(newAccessToken);
    } catch {
      reject(Errors.TOKEN_EXPIRED());
    }
  });
}

/**
 * Express middleware to require authentication.
 * Adds `req.user` with the decoded JWT payload.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED', action: 'login-again' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'TOKEN_EXPIRED', action: 'login-again' });
  }
}

/**
 * Express middleware to require admin role.
 * Must be used AFTER authMiddleware.
 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as AuthPayload;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required', code: 'ADMIN_REQUIRED', action: 'contact-support' });
    return;
  }
  next();
}
