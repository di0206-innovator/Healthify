import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// --- Auth Schemas ---

export const SignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// --- Scan Schemas ---

export const ScanRequestSchema = z.object({
  ingredientText: z.string().min(1, 'Ingredient text is required').max(10000),
  country: z.enum(['India', 'USA', 'EU', 'Canada', 'Australia', 'UK']).default('India'),
});

export const OcrRequestSchema = z.object({
  imageBase64: z.string().min(1, 'Image data is required'),
});

// --- Middleware Wrapper ---

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated; // Replace with validated/parsed data
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map(e => ({ path: e.path, message: e.message }))
        });
      }
      return res.status(500).json({ error: 'Internal validation error' });
    }
  };
}
