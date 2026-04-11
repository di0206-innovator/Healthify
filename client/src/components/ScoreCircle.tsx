import { useEffect, useState } from 'react';

interface ScoreCircleProps {
  score: number;
  grade: string;
  harmfulCount: number;
  totalCount: number;
}

function getScoreColor(score: number): { bg: string; text: string; wrapper: string; badge: string; shadow: string } {
  if (score >= 80) return { bg: 'bg-brutal-green', text: 'text-brutal-black', wrapper: 'border-brutal-black bg-brutal-green', badge: 'bg-brutal-yellow', shadow: '#FFD000' };
  if (score >= 60) return { bg: 'bg-brutal-yellow', text: 'text-brutal-black', wrapper: 'border-brutal-black bg-brutal-yellow', badge: 'bg-white', shadow: '#E0E0E0' };
  if (score >= 40) return { bg: 'bg-brutal-orange', text: 'text-brutal-black', wrapper: 'border-brutal-black bg-brutal-orange', badge: 'bg-white', shadow: '#1A1A1A' };
  return { bg: 'bg-brutal-red', text: 'text-brutal-black', wrapper: 'border-brutal-black bg-brutal-red text-white', badge: 'bg-brutal-black text-white', shadow: '#1A1A1A' };
}

export default function ScoreCircle({ score, grade, harmfulCount, totalCount }: ScoreCircleProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const colors = getScoreColor(score);

  // Animate score number
  useEffect(() => {
    let start = 0;
    const end = score;
    const duration = 1500;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setAnimatedScore(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }
    requestAnimationFrame(animate);
  }, [score]);

  return (
    <div className="flex flex-col items-center animate-pop-in" id="score-circle">
      {/* Circle SVG / Stamp */}
      <div 
        className={`relative w-48 h-48 rounded-full border-8 border-brutal-black flex flex-col items-center justify-center -rotate-3 transition-transform hover:rotate-0 hover:scale-105 ${colors.wrapper}`}
        style={{
          boxShadow: `8px 8px 0px 0px rgba(26,26,26,1)`
        }}
      >
        <span className={`text-[80px] leading-none font-display font-black ${colors.text} drop-shadow-[2px_2px_0_#fff]`}>
          {animatedScore}
        </span>
        <span className={`text-base font-black uppercase tracking-widest mt-1 ${colors.text} border-t-4 border-brutal-black pt-1 px-4`}>
          out of 100
        </span>
      </div>

      {/* Grade badge */}
      <div className={`mt-6 px-6 py-2 border-4 border-brutal-black shadow-[4px_4px_0_0_#1A1A1A] rotate-2 ${colors.badge}`}>
        <span className={`text-2xl font-black uppercase tracking-widest ${colors.text}`}>
          Grade {grade}
        </span>
      </div>

      {/* Summary */}
      <p className="mt-5 text-lg font-bold text-brutal-black bg-white border-2 border-brutal-black px-4 py-2 shadow-[2px_2px_0_0_#1A1A1A]">
        <span className={`text-xl bg-brutal-red text-white px-2 py-0.5 border-2 border-brutal-black mr-1`}>{harmfulCount}</span>
        of {totalCount} ingredients flagged
      </p>
    </div>
  );
}
