import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import { runPipeline } from './pipeline';
import { callGeminiVision } from './agents/ai';
import { hashPassword, verifyPassword, generateToken, authMiddleware, adminMiddleware, verifyToken } from './auth';
import {
  findUserByEmail, findUserById, createUser, toPublicUser,
  saveScan, getScansForUser, getAllScans, getScanById, getAllUsers, getStats,
} from './store';
import { validate, SignupSchema, LoginSchema, ScanRequestSchema, OcrRequestSchema } from './validation';
import type { ScanRequest, OcrRequest, SignupRequest, LoginRequest } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' })); // Reduced limit for safety

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP
  message: { error: 'Too many requests, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Rate limit exceeded' },
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
    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    return res.status(201).json({
      token,
      user: toPublicUser(user),
    });
  } catch (error: any) {
    if (error.message === 'Email already registered') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Signup error:', error);
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
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    return res.json({
      token,
      user: toPublicUser(user),
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
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
 * POST /api/scan — runs the 4-agent AI pipeline
 * Optionally saves to history if authenticated
 */
app.post('/api/scan', apiLimiter, validate(ScanRequestSchema), async (req, res) => {
  try {
    const { ingredientText, country } = req.body as ScanRequest;

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

    return res.json({ ...report, scanId: savedScan?.id });
  } catch (error: any) {
    console.error('Scan error:', error);

    if (error.message === 'Agent returned unparseable response') {
      return res.status(422).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'An error occurred during scan',
      message: error.message || 'Unknown error',
    });
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

    const prompt =
      'Extract the complete ingredients list from this food product label image. Return only the raw ingredient text, nothing else. If you cannot find an ingredient list, return "NO_INGREDIENTS_FOUND".';

    const ingredientText = await callGeminiVision(prompt, base64Data, mimeType);

    if (ingredientText === 'NO_INGREDIENTS_FOUND') {
      return res.status(400).json({
        error: 'Could not find an ingredient list in the image. Please try a clearer image.',
      });
    }

    return res.json({ ingredientText });
  } catch (error: any) {
    console.error('OCR error:', error);
    return res.status(500).json({ error: 'Failed to process image', message: error.message || 'Unknown error' });
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

// ========== Admin Routes ==========

/**
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (_req, res) => {
  return res.json(await getStats());
});

/**
 * GET /api/admin/scans — all scans
 */
app.get('/api/admin/scans', authMiddleware, adminMiddleware, async (_req, res) => {
  return res.json({ scans: await getAllScans() });
});

/**
 * GET /api/admin/users — all users
 */
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (_req, res) => {
  return res.json({ users: await getAllUsers() });
});

// ========== Error Handling Middleware ==========
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('🔥 Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// ========== Start Server ==========
app.listen(PORT, () => {
  console.log(`🧪 Healthify server running on http://localhost:${PORT}`);
});
