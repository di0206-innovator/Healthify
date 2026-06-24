import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SignupSchema, LoginSchema, ScanRequestSchema, OcrRequestSchema } from '../validation';

describe('Zod Validation Schemas', () => {
  describe('SignupSchema', () => {
    test('should pass with valid signup data', () => {
      const result = SignupSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      });
      assert.strictEqual(result.success, true);
    });

    test('should fail with invalid email', () => {
      const result = SignupSchema.safeParse({
        name: 'John Doe',
        email: 'invalid-email',
        password: 'password123',
      });
      assert.strictEqual(result.success, false);
    });

    test('should fail with short password', () => {
      const result = SignupSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: '123',
      });
      assert.strictEqual(result.success, false);
    });
  });

  describe('LoginSchema', () => {
    test('should pass with valid credentials', () => {
      const result = LoginSchema.safeParse({
        email: 'john@example.com',
        password: 'password123',
      });
      assert.strictEqual(result.success, true);
    });

    test('should fail with empty password', () => {
      const result = LoginSchema.safeParse({
        email: 'john@example.com',
        password: '',
      });
      assert.strictEqual(result.success, false);
    });
  });

  describe('ScanRequestSchema', () => {
    test('should pass with valid ingredients and country', () => {
      const result = ScanRequestSchema.safeParse({
        ingredientText: 'Maltodextrin, MSG, Sugar',
        country: 'India',
      });
      assert.strictEqual(result.success, true);
    });

    test('should fallback to default country if omitted', () => {
      const result = ScanRequestSchema.safeParse({
        ingredientText: 'Maltodextrin, MSG, Sugar',
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.country, 'India');
    });

    test('should fail with invalid country enum', () => {
      const result = ScanRequestSchema.safeParse({
        ingredientText: 'Maltodextrin',
        country: 'France', // Not in enum
      });
      assert.strictEqual(result.success, false);
    });
  });

  describe('OcrRequestSchema', () => {
    test('should pass with valid base64 image data', () => {
      const result = OcrRequestSchema.safeParse({
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
      });
      assert.strictEqual(result.success, true);
    });

    test('should fail with empty base64 string', () => {
      const result = OcrRequestSchema.safeParse({
        imageBase64: '',
      });
      assert.strictEqual(result.success, false);
    });
  });
});
