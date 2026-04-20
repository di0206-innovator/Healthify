/**
 * Typed error classes for the Healthify API.
 * Each error has a machine-readable code, a user-friendly message,
 * and a suggested client-side action.
 */

export type ErrorAction =
  | 'retry'
  | 'retry-later'
  | 'change-file'
  | 'check-connection'
  | 'contact-support'
  | 'login-again';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly action: ErrorAction;

  constructor(code: string, message: string, statusCode: number = 500, action: ErrorAction = 'contact-support') {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.action = action;
  }
}

export class ScanError extends AppError {
  constructor(code: string, message: string, statusCode: number = 500, action: ErrorAction = 'retry') {
    super(code, message, statusCode, action);
    this.name = 'ScanError';
  }
}

export class AuthError extends AppError {
  constructor(code: string, message: string, statusCode: number = 401, action: ErrorAction = 'login-again') {
    super(code, message, statusCode, action);
    this.name = 'AuthError';
  }
}

// ─── Pre-defined error factories ─────────────────────────────────────

export const Errors = {
  // Scan errors
  IMAGE_TOO_LARGE: () =>
    new ScanError('IMAGE_TOO_LARGE', 'Image is too large (max 5MB). Compress it and try again.', 413, 'change-file'),

  INVALID_IMAGE_FORMAT: () =>
    new ScanError('INVALID_IMAGE_FORMAT', 'Image must be JPEG, PNG, or WebP.', 400, 'change-file'),

  NO_INGREDIENTS_FOUND: () =>
    new ScanError('NO_INGREDIENTS_FOUND', 'Could not find an ingredient list in the image. Try a clearer photo.', 400, 'change-file'),

  SCAN_PARSE_FAILED: () =>
    new ScanError('SCAN_PARSE_FAILED', 'The AI could not parse the ingredients. Please try rephrasing or a clearer image.', 422, 'retry'),

  API_TIMEOUT: () =>
    new ScanError('API_TIMEOUT', 'Processing took too long. Try again in a moment.', 504, 'retry'),

  API_OVERLOADED: () =>
    new ScanError('API_OVERLOADED', 'Our AI service is temporarily unavailable due to high demand. Please try again in 1-2 minutes.', 429, 'retry-later'),

  SCAN_IN_PROGRESS: () =>
    new ScanError('SCAN_IN_PROGRESS', 'You already have a scan running. Please wait for it to finish.', 429, 'retry-later'),

  // Auth errors
  INVALID_CREDENTIALS: () =>
    new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.', 401),

  EMAIL_TAKEN: () =>
    new AuthError('EMAIL_TAKEN', 'This email is already registered.', 409, 'login-again'),

  TOKEN_EXPIRED: () =>
    new AuthError('TOKEN_EXPIRED', 'Your session has expired. Please log in again.', 401),

  TOKEN_INVALID: () =>
    new AuthError('TOKEN_INVALID', 'Invalid authentication token.', 401),

  ADMIN_REQUIRED: () =>
    new AuthError('ADMIN_REQUIRED', 'Admin access required.', 403, 'contact-support'),

  // Generic
  INTERNAL: (detail?: string) =>
    new AppError('INTERNAL_ERROR', detail || 'An unexpected error occurred. Please try again.', 500, 'retry'),
} as const;

/**
 * Serialize an AppError for the API response.
 */
export function toErrorResponse(error: unknown, includeStack = false) {
  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      action: error.action,
      ...(includeStack && { stack: error.stack }),
    };
  }

  // Unknown error
  return {
    error: 'An unexpected error occurred.',
    code: 'INTERNAL_ERROR',
    action: 'retry' as ErrorAction,
  };
}
