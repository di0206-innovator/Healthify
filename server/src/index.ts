import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runPipeline } from './pipeline';
import { callGeminiVision } from './agents/ai';
import { hashPassword, verifyPassword, generateToken, authMiddleware, adminMiddleware, verifyToken } from './auth';
import {
  findUserByEmail, findUserById, createUser, toPublicUser,
  saveScan, getScansForUser, getAllScans, getScanById, getAllUsers, getStats,
} from './store';
import type { ScanRequest, OcrRequest, SignupRequest, LoginRequest } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ========== Health Check ==========
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== Auth Routes ==========

/**
 * POST /api/auth/signup
 */
app.post('/api/auth/signup', (req, res) => {
  try {
    const { name, email, password } = req.body as SignupRequest;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = hashPassword(password);
    const user = createUser(name.trim(), email.trim(), passwordHash);
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
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = findUserByEmail(email.trim());
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
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const payload = (req as any).user;
  const user = findUserById(payload.userId);
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
app.post('/api/scan', async (req, res) => {
  try {
    const { ingredientText, country } = req.body as ScanRequest;

    if (!ingredientText || !ingredientText.trim()) {
      return res.status(400).json({ error: 'ingredientText is required' });
    }

    const validCountries = ['India', 'USA', 'EU', 'Canada', 'Australia', 'UK'];
    const selectedCountry = validCountries.includes(country) ? country : 'India';

    const report = await runPipeline(ingredientText.trim(), selectedCountry);

    // If user is authenticated, save to history
    let savedScan;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const payload = verifyToken(authHeader.slice(7));
        const user = findUserById(payload.userId);
        if (user) {
          report.inputText = ingredientText.trim();
          savedScan = saveScan(user.id, user.name, report);
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
app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64 } = req.body as OcrRequest;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

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
app.get('/api/scans/history', authMiddleware, (req, res) => {
  const payload = (req as any).user;
  const scans = getScansForUser(payload.userId);
  return res.json({ scans });
});

/**
 * GET /api/scans/:id — get a specific scan by ID
 */
app.get('/api/scans/:id', (req, res) => {
  const scan = getScanById(req.params.id);
  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }
  return res.json({ scan });
});

// ========== Admin Routes ==========

/**
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', authMiddleware, adminMiddleware, (_req, res) => {
  return res.json(getStats());
});

/**
 * GET /api/admin/scans — all scans
 */
app.get('/api/admin/scans', authMiddleware, adminMiddleware, (_req, res) => {
  return res.json({ scans: getAllScans() });
});

/**
 * GET /api/admin/users — all users
 */
app.get('/api/admin/users', authMiddleware, adminMiddleware, (_req, res) => {
  return res.json({ users: getAllUsers() });
});

// ========== Start Server ==========
app.listen(PORT, () => {
  console.log(`🧪 Healthify server running on http://localhost:${PORT}`);
  console.log(`🔑 Default admin: admin@healthify.com / admin123`);
});
