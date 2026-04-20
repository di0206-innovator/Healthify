import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { runPipeline } from './pipeline';
import { callGeminiVision } from './agents/ai';
import { hashPassword, verifyPassword, generateToken, generateTokens, refreshAccessToken, authMiddleware, adminMiddleware, verifyToken } from './auth';
import {
  findUserByEmail, findUserById, createUser, toPublicUser,
  saveScan, getScansForUser, getAllScans, getScanById, getAllUsers, getStats,
  getPaginatedScans, getPaginatedUsers, getUserDataExport, deleteUser,
} from './store';
import { validate, SignupSchema, LoginSchema, ScanRequestSchema, OcrRequestSchema } from './validation';
import type { ScanRequest, OcrRequest, SignupRequest, LoginRequest } from './types';
import logger from './utils/logger';
import { Errors, toErrorResponse, AppError } from './utils/errors';

// Production Environment Validation
const REQUIRED_ENV_VARS = ['GEMINI_API_KEY', 'JWT_SECRET'];
REQUIRED_ENV_VARS.forEach((key) => {
  const val = process.env[key];
  if (!val || val === 'your_key_here') {
    logger.error(`❌ CRITICAL: Environment variable ${key} is missing or placeholder.`);
    process.exit(1);
  }

  // Format check for GEMINI_API_KEY
  if (key === 'GEMINI_API_KEY' && !val.startsWith('AIza')) {
    logger.warn(`⚠️  WARNING: GEMINI_API_KEY does not start with 'AIza'. This might cause 429 or auth errors.`);
  }
});

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: isProduction 
    ? (process.env.ALLOWED_ORIGINS?.split(',') || []) 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));

// ========== Rate Limiters ==========

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP
  message: { error: 'Too many requests, please try again after 15 minutes', code: 'RATE_LIMIT', action: 'retry-later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Rate limit exceeded', code: 'RATE_LIMIT', action: 'retry-later' },
});

// Per-user scan limiter: 10 scans per hour
const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  validate: false as any, // We use JWT-based keying with IP fallback
  keyGenerator: (req) => {
    // Try to extract user ID from token for per-user limiting
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const payload = verifyToken(authHeader.slice(7));
        return `scan:${payload.userId}`;
      }
    } catch { /* fall through to IP */ }
    return `scan:${req.ip || 'anonymous'}`;
  },
  message: { error: 'Too many scans. Please try again in an hour.', code: 'SCAN_RATE_LIMIT', action: 'retry-later' },
});

// ========== Concurrent Scan Prevention ==========

const scansInProgress = new Set<string>();

function preventConcurrentScans(req: express.Request, res: express.Response, next: express.NextFunction): void {
  let userId = req.ip || 'anonymous';
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const payload = verifyToken(authHeader.slice(7));
      userId = payload.userId;
    }
  } catch { /* use IP */ }

  if (scansInProgress.has(userId)) {
    const err = Errors.SCAN_IN_PROGRESS();
    res.status(err.statusCode).json(toErrorResponse(err));
    return;
  }

  scansInProgress.add(userId);
  res.on('finish', () => scansInProgress.delete(userId));
  next();
}

// ========== Request Logging Middleware ==========

app.use((req, _res, next) => {
  logger.debug('Request', { method: req.method, path: req.path, ip: req.ip });
  next();
});

// ========== Health Check ==========
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== Auth Routes ==========

/**
 * POST /api/auth/signup
 */
app.post('/api/auth/signup', authLimiter, validate(SignupSchema), async (req, res) => {
  try {
    const { name, email, password } = req.body as SignupRequest;

    const passwordHash = hashPassword(password);
    const user = await createUser(name.trim(), email.trim(), passwordHash);
    const { accessToken, refreshToken } = generateTokens({ userId: user.id, email: user.email, role: user.role });

    logger.info('User signed up', { userId: user.id, email: user.email });

    return res.status(201).json({
      token: accessToken,             // Primary access token
      refreshToken,                   // For token renewal
      user: toPublicUser(user),
    });
  } catch (error: any) {
    if (error.message === 'Email already registered') {
      return res.status(409).json(toErrorResponse(Errors.EMAIL_TAKEN()));
    }
    logger.error('Signup error', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Failed to create account' });
  }
});

/**
 * POST /api/auth/login
 */
app.post('/api/auth/login', authLimiter, validate(LoginSchema), async (req, res) => {
  try {
    const { email, password } = req.body as LoginRequest;

    const user = await findUserByEmail(email.trim());
    if (!user) {
      return res.status(401).json(toErrorResponse(Errors.INVALID_CREDENTIALS()));
    }

    if (!verifyPassword(password, user.passwordHash)) {
      logger.warn('Failed login attempt', { email: email.trim(), ip: req.ip });
      return res.status(401).json(toErrorResponse(Errors.INVALID_CREDENTIALS()));
    }

    const { accessToken, refreshToken } = generateTokens({ userId: user.id, email: user.email, role: user.role });

    logger.info('User logged in', { userId: user.id, email: user.email });

    return res.json({
      token: accessToken,
      refreshToken,
      user: toPublicUser(user),
    });
  } catch (error: any) {
    logger.error('Login error', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/refresh — exchange a refresh token for a new access token
 */
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const newAccessToken = await refreshAccessToken(refreshToken, async (userId) => {
      const user = await findUserById(userId);
      if (!user) return null;
      return { userId: user.id, email: user.email, role: user.role };
    });

    return res.json({ token: newAccessToken });
  } catch (error: any) {
    logger.warn('Refresh token failed', { error: error.message });
    return res.status(401).json(toErrorResponse(Errors.TOKEN_EXPIRED()));
  }
});

/**
 * GET /api/auth/me — returns current user from token
 */
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const payload = (req as any).user;
  const user = await findUserById(payload.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user: toPublicUser(user) });
});

// ========== Scan Routes ==========

/**
 * POST /api/scan — runs the AI pipeline
 * Includes per-user rate limiting and concurrent scan prevention
 */
app.post('/api/scan', apiLimiter, scanLimiter, preventConcurrentScans, validate(ScanRequestSchema), async (req, res) => {
  const startTime = Date.now();

  try {
    const { ingredientText, country } = req.body as ScanRequest;

    logger.info('Scan started', { country, inputLength: ingredientText.length });

    const report = await runPipeline(ingredientText.trim(), country);

    // If user is authenticated, save to history
    let savedScan;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const payload = verifyToken(authHeader.slice(7));
        const user = await findUserById(payload.userId);
        if (user) {
          report.inputText = ingredientText.trim();
          savedScan = await saveScan(user.id, user.name, report);
        }
      }
    } catch {
      // Silently skip save if auth fails — scan still works without login
    }

    const processingTime = Date.now() - startTime;
    logger.info('Scan completed', {
      score: report.safetyScore,
      grade: report.grade,
      ingredientCount: report.totalCount,
      harmfulCount: report.harmfulCount,
      processingTimeMs: processingTime,
      saved: !!savedScan,
    });

    return res.json({ ...report, scanId: savedScan?.id });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logger.error('Scan failed', { error: error.message, processingTimeMs: processingTime, stack: error.stack });

    if (error.status === 429 || error.message?.includes('429')) {
      const err = Errors.API_OVERLOADED();
      return res.status(err.statusCode).json(toErrorResponse(err));
    }

    if (error.message === 'Agent returned unparseable response') {
      const err = Errors.SCAN_PARSE_FAILED();
      return res.status(err.statusCode).json(toErrorResponse(err));
    }

    if (error.message?.includes('timed out')) {
      const err = Errors.API_TIMEOUT();
      return res.status(err.statusCode).json(toErrorResponse(err));
    }

    return res.status(500).json(toErrorResponse(Errors.INTERNAL(error.message)));
  }
});

/**
 * POST /api/ocr — Gemini Vision OCR for food labels
 */
app.post('/api/ocr', apiLimiter, validate(OcrRequestSchema), async (req, res) => {
  try {
    const { imageBase64 } = req.body as OcrRequest;

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    let mimeType = 'image/jpeg';
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];

    logger.info('OCR started', { mimeType, dataLength: base64Data.length });

    const prompt =
      'Extract the complete ingredients list from this food product label image. Return only the raw ingredient text, nothing else. If you cannot find an ingredient list, return "NO_INGREDIENTS_FOUND".';

    const ingredientText = await callGeminiVision(prompt, base64Data, mimeType);

    if (ingredientText === 'NO_INGREDIENTS_FOUND') {
      const err = Errors.NO_INGREDIENTS_FOUND();
      return res.status(err.statusCode).json(toErrorResponse(err));
    }

    logger.info('OCR completed', { extractedLength: ingredientText.length });
    return res.json({ ingredientText });
  } catch (error: any) {
    logger.error('OCR error', { error: error.message, stack: error.stack });
    return res.status(500).json(toErrorResponse(Errors.INTERNAL('Failed to process image')));
  }
});

// ========== User History Routes ==========

/**
 * GET /api/scans/history — authenticated user's scan history
 */
app.get('/api/scans/history', authMiddleware, async (req, res) => {
  const payload = (req as any).user;
  const scans = await getScansForUser(payload.userId);
  return res.json({ scans });
});

/**
 * GET /api/scans/:id — get a specific scan by ID
 */
app.get('/api/scans/:id', async (req, res) => {
  const scan = await getScanById(req.params.id);
  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }
  return res.json({ scan });
});

// ========== GDPR Routes ==========

/**
 * GET /api/user/data-export — download all user data as JSON
 */
app.get('/api/user/data-export', authMiddleware, async (req, res) => {
  const payload = (req as any).user;
  const exportData = await getUserDataExport(payload.userId);

  if (!exportData) {
    return res.status(404).json({ error: 'User not found' });
  }

  logger.info('GDPR data export', { userId: payload.userId });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=healthify-my-data.json');
  return res.send(JSON.stringify(exportData, null, 2));
});

/**
 * DELETE /api/user/account — delete account and all associated data
 */
app.delete('/api/user/account', authMiddleware, async (req, res) => {
  const payload = (req as any).user;

  logger.warn('GDPR account deletion requested', { userId: payload.userId, email: payload.email });

  const deleted = await deleteUser(payload.userId);
  if (!deleted) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ message: 'Account and all associated data have been permanently deleted.' });
});

// ========== Admin Routes ==========

/**
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (_req, res) => {
  logger.info('Admin stats accessed', { adminId: (_req as any).user?.userId });
  return res.json(await getStats());
});

/**
 * GET /api/admin/scans — paginated scan list
 * Query params: ?page=1&limit=50
 */
app.get('/api/admin/scans', authMiddleware, adminMiddleware, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

  logger.info('Admin scans accessed', { adminId: (req as any).user?.userId, page, limit });

  const result = await getPaginatedScans(page, limit);
  return res.json(result);
});

/**
 * GET /api/admin/users — paginated user list
 * Query params: ?page=1&limit=50
 */
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

  logger.info('Admin users accessed', { adminId: (req as any).user?.userId, page, limit });

  const result = await getPaginatedUsers(page, limit);
  return res.json(result);
});

// ========== Error Handling Middleware ==========
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AppError) {
    logger.error('Handled error', { code: err.code, message: err.message, statusCode: err.statusCode });
    return res.status(err.statusCode).json(toErrorResponse(err));
  }

  logger.error('🔥 Unhandled server error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: isProduction ? 'Something went wrong' : err.message,
    code: 'INTERNAL_ERROR',
    action: 'retry',
  });
});

// ========== Start Server ==========
app.listen(PORT, () => {
  logger.info(`🧪 Healthify server running on http://localhost:${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
  });
});
