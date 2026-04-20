import { useState, useRef } from 'react';
import { COUNTRIES, SAMPLE_INGREDIENTS } from '../types';
import type { ScanStep, ScanReport } from '../types';
import { useAuth } from '../context/AuthContext';
import ProgressIndicator from './ProgressIndicator';
import { parseApiError, getActionLabel, getActionIcon, compressImage } from '../utils/errors';
import type { ApiError } from '../utils/errors';

interface ScannerProps {
  onReportReady: (report: ScanReport) => void;
  ingredientText: string;
  setIngredientText: (text: string) => void;
  country: string;
  setCountry: (country: string) => void;
}

export default function Scanner({ 
  onReportReady, 
  ingredientText, 
  setIngredientText, 
  country, 
  setCountry 
}: ScannerProps) {
  const { token } = useAuth();
  
  const [currentStep, setCurrentStep] = useState<ScanStep>('idle');
  const [error, setError] = useState<ApiError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isScanning = currentStep !== 'idle' && currentStep !== 'done' && currentStep !== 'error';

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError({ message: 'Please upload a JPEG, PNG, or WebP image.', code: 'INVALID_FORMAT', action: 'change-file' });
      return;
    }

    setOcrLoading(true);
    setError(null);
    setErrorMessage(null);

    try {
      // Compress image before upload (max 1MB, max 1920px)
      const compressedBase64 = await compressImage(file, 1, 1920);
      setImagePreview(compressedBase64);

      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: compressedBase64 }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const apiErr = parseApiError(errData);
        setError(apiErr);
        return;
      }

      const data = await res.json();
      setIngredientText(data.ingredientText);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to extract text from image';
      setErrorMessage(message);
    } finally {
      setOcrLoading(false);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleScan = async () => {
    if (!ingredientText.trim()) {
      setErrorMessage('Please enter or upload an ingredient list');
      return;
    }

    setError(null);
    setErrorMessage(null);
    setCurrentStep('parsing');

    // Simulate step progression with timing
    const stepTimings: { step: ScanStep; delay: number }[] = [
      { step: 'parsing', delay: 0 },
      { step: 'analysing', delay: 2000 },
      { step: 'checking-bans', delay: 4000 },
      { step: 'finding-alternatives', delay: 4000 },
      { step: 'generating-report', delay: 6000 },
    ];

    // Start step timer progression
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const { step, delay } of stepTimings) {
      if (delay > 0) {
        timers.push(setTimeout(() => setCurrentStep(step), delay));
      }
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ingredientText: ingredientText.trim(), country }),
      });

      // Clear step timers
      timers.forEach(clearTimeout);

      if (!res.ok) {
        let errData;
        try {
          errData = await res.json();
        } catch {
          errData = { error: `Server Error (${res.status})` };
        }
        const apiErr = parseApiError(errData);
        setError(apiErr);
        setCurrentStep('error');
        return;
      }

      try {
        const report: ScanReport = await res.json();
        setCurrentStep('done');
        onReportReady(report);
      } catch (err) {
        console.error('Failed to parse scan report:', err);
        setError({ message: 'Received an invalid response from the server. Please try again.', code: 'PARSE_ERROR', action: 'retry' });
        setCurrentStep('error');
      }
    } catch (err: unknown) {
      timers.forEach(clearTimeout);
      setCurrentStep('error');
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(message);
    }
  };

  // Error action handlers
  const handleErrorAction = () => {
    if (!error) return;
    switch (error.action) {
      case 'retry':
        setError(null);
        setErrorMessage(null);
        setCurrentStep('idle');
        handleScan();
        break;
      case 'change-file':
        setError(null);
        setErrorMessage(null);
        clearImage();
        setCurrentStep('idle');
        break;
      case 'retry-later':
        setError(null);
        setErrorMessage(null);
        setCurrentStep('idle');
        break;
      default:
        setError(null);
        setErrorMessage(null);
        setCurrentStep('idle');
    }
  };

  const activeError = error || (errorMessage ? { message: errorMessage, code: 'UNKNOWN', action: 'retry' as const } : null);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6" id="scanner">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 
          className="font-display font-black text-brutal-black leading-[0.9] tracking-tighter uppercase" 
          style={{ fontSize: 'var(--font-size-hero)', textShadow: 'var(--brutal-shadow)' }}
        >
          Scan Your <br className="sm:hidden" /> Ingredients
        </h1>
        <div className="flex justify-center">
          <p className="text-brutal-black text-lg sm:text-xl font-bold max-w-md bg-white border-4 border-brutal-black px-6 py-2 rounded-xl shadow-brutal rotate-1 inline-block">
            Health-check your food in seconds.
          </p>
        </div>
      </div>

      {/* Input Area */}
      <div className="brutal-card p-6 sm:p-8 space-y-6 bg-[#E0E0E0]">
        {/* Image upload area */}
        {imagePreview ? (
          <div className="relative rounded-xl overflow-hidden border-4 border-brutal-black bg-white">
            <img src={imagePreview} alt="Uploaded label" className="w-full max-h-48 object-cover opacity-80" />
            {ocrLoading && (
              <div className="absolute inset-0 bg-brutal-yellow/90 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-brutal-black border-dashed rounded-full animate-[spin_3s_linear_infinite]" />
                <span className="text-xl text-brutal-black font-black uppercase tracking-widest bg-white px-3 py-1 border-2 border-brutal-black rounded-md shadow-[2px_2px_0_0_#1A1A1A] -rotate-2">Extracting...</span>
              </div>
            )}
            <button
              onClick={clearImage}
              className="absolute top-3 right-3 w-10 h-10 rounded-full border-4 border-brutal-black bg-brutal-red flex items-center justify-center text-brutal-black font-black text-xl hover:bg-brutal-yellow transition-colors hover:scale-110 active:scale-95 shadow-[2px_2px_0_0_#1A1A1A]"
            >
              ✕
            </button>
          </div>
        ) : null}

        {/* Textarea */}
        <div>
          <label htmlFor="ingredient-input" className="block text-lg font-black text-brutal-black mb-3 uppercase tracking-wider">
            Ingredient List
          </label>
          <textarea
            id="ingredient-input"
            value={ingredientText}
            onChange={(e) => setIngredientText(e.target.value)}
            placeholder="Paste ingredient list here..."
            rows={6}
            className="brutal-input resize-none text-base"
            disabled={isScanning}
          />
        </div>

        {/* Upload + Country row */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Image upload */}
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
              disabled={isScanning}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary w-full flex items-center justify-center gap-3 text-base uppercase tracking-wide"
              disabled={isScanning || ocrLoading}
              id="upload-button"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Upload Photo
            </button>
          </div>

          {/* Country dropdown */}
          <div className="flex-1">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="brutal-input h-full cursor-pointer uppercase appearance-none font-bold"
              disabled={isScanning}
              id="country-selector"
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} ({c.agency})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Display with Contextual Actions */}
        {activeError && (
          <div className="bg-brutal-red border-4 border-brutal-black rounded-xl px-5 py-4 shadow-[4px_4px_0_0_#1A1A1A] animate-pop-in space-y-3" id="error-message">
            <div className="flex items-start gap-3">
              <svg className="w-8 h-8 text-brutal-black flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-xl font-black text-brutal-black uppercase">Oops! Error</p>
                <p className="text-base font-bold text-brutal-black mt-1">{activeError.message}</p>
              </div>
            </div>
            {/* Contextual action button */}
            {error && (
              <button
                onClick={handleErrorAction}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-base uppercase tracking-wide"
              >
                <span>{getActionIcon(error.action)}</span>
                <span>{getActionLabel(error.action)}</span>
              </button>
            )}
          </div>
        )}

        {/* Scan Button */}
        <button
          onClick={handleScan}
          disabled={isScanning || ocrLoading || !ingredientText.trim()}
          className="btn-primary w-full text-xl sm:text-2xl uppercase tracking-wider py-5 sm:py-6 flex items-center justify-center gap-3 active:scale-95"
          id="scan-button"
        >
          {isScanning ? (
            <>
              <div className="w-8 h-8 border-4 border-brutal-black border-dashed rounded-full animate-spin-slow" />
              <span className="animate-bounce-slight inline-block">Scanning...</span>
            </>
          ) : (
            <>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Scan Ingredients
            </>
          )}
        </button>
      </div>

      {/* Progress Indicator */}
      {isScanning && <ProgressIndicator currentStep={currentStep} />}
    </div>
  );
}
