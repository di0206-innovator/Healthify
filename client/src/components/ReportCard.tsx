import { useState } from 'react';
import type { ScanReport } from '../types';
import ScoreCircle from './ScoreCircle';
import IngredientCard from './IngredientCard';

interface ReportCardProps {
  report: ScanReport;
  onScanAgain: () => void;
}

export default function ReportCard({ report, onScanAgain }: ReportCardProps) {
  const [showSafe, setShowSafe] = useState(false);
  const [copied, setCopied] = useState(false);

  const flaggedIngredients = report.ingredients.filter((i) => i.severity !== 'safe');
  const safeIngredients = report.ingredients.filter((i) => i.severity === 'safe');

  // Sort flagged by severity: high → medium → low
  const severityOrder = { high: 0, medium: 1, low: 2, safe: 3 };
  flaggedIngredients.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const handleShare = async () => {
    const lines = [
      `🧪 Healthify Safety Report`,
      `Score: ${report.safetyScore}/100 (Grade ${report.grade})`,
      `${report.harmfulCount} of ${report.totalCount} ingredients flagged`,
      `Country: ${report.country}`,
      ``,
      `⚠️ Flagged Ingredients:`,
      ...flaggedIngredients.map(
        (i) => `• ${i.ingredient} [${i.severity.toUpperCase()}] — ${i.reason}`
      ),
      ``,
      `Scanned with Healthify — Know what you eat.`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = lines.join('\n');
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 animate-fade-in" id="scan-report">
      {/* Score Card */}
      <div className="brutal-card p-10 text-center bg-white border-8 border-brutal-black shadow-[8px_8px_0_0_#1A1A1A]">
        <h2 className="text-3xl font-black text-brutal-black uppercase tracking-widest mb-8 border-b-4 border-brutal-black pb-4 inline-block">
          Safety Score
        </h2>
        <ScoreCircle
          score={report.safetyScore}
          grade={report.grade}
          harmfulCount={report.harmfulCount}
          totalCount={report.totalCount}
        />

        {/* Meta info */}
        <div className="mt-8 flex items-center justify-center gap-4 text-sm font-bold text-brutal-black border-4 border-brutal-black inline-flex px-4 py-2 bg-brutal-yellow uppercase">
          <span>📍 {report.country}</span>
          <span className="w-2 h-2 bg-brutal-black rounded-full block"></span>
          <span>🕐 {new Date(report.scannedAt).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Flagged Ingredients */}
      {flaggedIngredients.length > 0 && (
        <div className="mt-12">
          <h2 className="text-3xl font-display font-black text-brutal-black mb-6 uppercase tracking-wider inline-block border-2 border-brutal-black px-4 py-2 bg-brutal-red shadow-[4px_4px_0_0_#1A1A1A] -rotate-1">
            ⚠️ Flagged
            <span className="ml-3 px-2 py-0.5 bg-white border-2 border-brutal-black rounded-lg text-xl">{flaggedIngredients.length}</span>
          </h2>
          <div className="space-y-3">
            {flaggedIngredients.map((ingredient, index) => (
              <IngredientCard key={ingredient.ingredient} ingredient={ingredient} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* Safe Ingredients */}
      {safeIngredients.length > 0 && (
        <div className="mt-12">
          <button
            onClick={() => setShowSafe(!showSafe)}
            className="flex items-center gap-3 text-xl font-black text-brutal-black bg-white border-4 border-brutal-black px-6 py-4 w-full justify-between hover:bg-brutal-green transition-colors shadow-[4px_4px_0_0_#1A1A1A] active:translate-y-1 active:translate-x-1 active:shadow-[-1px_-1px_0_0_#1A1A1A]"
            id="toggle-safe-ingredients"
          >
            <div className="flex items-center gap-3 uppercase">
               <span className="w-4 h-4 rounded-full border-2 border-brutal-black bg-brutal-green shadow-[2px_2px_0_0_#1A1A1A]"></span>
               Safe Ingredients
               <span className="bg-brutal-black text-brutal-green px-2 py-0.5 rounded-md text-base">{safeIngredients.length}</span>
            </div>
            <svg
              className={`w-8 h-8 transition-transform duration-300 ${showSafe ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showSafe && (
            <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 animate-pop-in">
              {safeIngredients.map((ingredient, index) => (
                <div
                  key={ingredient.ingredient}
                  className="brutal-card px-5 py-4 flex items-center gap-3 stagger-item bg-[#FDFBF7]"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <svg className="w-6 h-6 text-brutal-green flex-shrink-0 drop-shadow-[1px_1px_0_#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg font-bold text-brutal-black truncate">{ingredient.ingredient}</span>
                  <span className="text-xs font-bold text-brutal-black border-2 border-brutal-black bg-white px-2 py-0.5 uppercase ml-auto">{ingredient.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-5 pt-8">
        <button
          onClick={onScanAgain}
          className="btn-primary flex-1 flex items-center justify-center gap-3 text-xl uppercase tracking-wide py-5"
          id="scan-again-button"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Scan Another
        </button>

        <button
          onClick={handleShare}
          className="btn-secondary flex-1 flex items-center justify-center gap-3 text-xl uppercase tracking-wide py-5 bg-[#E0E0E0]"
          id="share-button"
        >
          {copied ? (
            <>
              <svg className="w-6 h-6 text-brutal-green drop-shadow-[1px_1px_0_#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Report
            </>
          )}
        </button>
      </div>
    </div>
  );
}
