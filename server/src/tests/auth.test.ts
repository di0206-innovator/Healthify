import { test, describe } from 'node:test';
import assert from 'node:assert';
import { hashPassword, verifyPassword, generateTokens, verifyToken } from '../auth';

describe('Auth Utilities', () => {
  test('should hash and verify passwords correctly', async () => {
    const password = 'my-secure-password';
    const hash = await hashPassword(password);
    
    assert.notStrictEqual(hash, password);
    assert.strictEqual(await verifyPassword(password, hash), true);
    assert.strictEqual(await verifyPassword('wrong-password', hash), false);
  });

  test('should fail verification with invalid hash format', async () => {
    assert.strictEqual(await verifyPassword('password', 'invalidhash'), false);
  });

  test('should generate and verify JWT tokens', () => {
    const payload = { userId: 'user-123', email: 'user@example.com', role: 'user' as const };
    const { accessToken, refreshToken } = generateTokens(payload);

    assert.ok(accessToken);
    assert.ok(refreshToken);

    const verified = verifyToken(accessToken);
    assert.strictEqual(verified.userId, payload.userId);
    assert.strictEqual(verified.email, payload.email);
    assert.strictEqual(verified.role, payload.role);
  });
});
