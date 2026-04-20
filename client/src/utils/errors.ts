/**
 * Frontend error handling utilities.
 * Maps API error codes to user-friendly messages with action suggestions.
 */

export type ErrorAction = 'retry' | 'retry-later' | 'change-file' | 'check-connection' | 'contact-support' | 'login-again';

export interface ApiError {
  message: string;
  code: string;
  action: ErrorAction;
  retryAfterMs?: number;
}

/**
 * Parse an API error response into a typed ApiError.
 */
export function parseApiError(response: any): ApiError {
  return {
    message: response?.error || 'An unexpected error occurred.',
    code: response?.code || 'UNKNOWN',
    action: response?.action || 'retry',
  };
}

/**
 * Get a user-friendly action label for the error action type.
 */
export function getActionLabel(action: ErrorAction): string {
  switch (action) {
    case 'retry': return 'Try Again';
    case 'retry-later': return 'Try Again Later';
    case 'change-file': return 'Try a Different Image';
    case 'check-connection': return 'Check Connection';
    case 'login-again': return 'Log In Again';
    case 'contact-support': return 'Contact Support';
    default: return 'Try Again';
  }
}

/**
 * Get the icon emoji for the error action type.
 */
export function getActionIcon(action: ErrorAction): string {
  switch (action) {
    case 'retry': return '🔄';
    case 'retry-later': return '⏳';
    case 'change-file': return '📸';
    case 'check-connection': return '📡';
    case 'login-again': return '🔑';
    case 'contact-support': return '📧';
    default: return '🔄';
  }
}

/**
 * Compress an image file before upload.
 * Returns a base64 data URL of the compressed image.
 */
export async function compressImage(file: File, maxSizeMB: number = 1, maxWidthPx: number = 1920): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Scale down if needed
        if (width > maxWidthPx) {
          height = Math.round((height * maxWidthPx) / width);
          width = maxWidthPx;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Start with high quality, reduce until under size limit
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        while (dataUrl.length > maxSizeMB * 1024 * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
