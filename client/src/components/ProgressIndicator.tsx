import type { ScanStep } from '../types';

interface ProgressIndicatorProps {
  currentStep: ScanStep;
}

const STEPS = [
  { key: 'parsing', label: 'Parsing ingredients', icon: '📝' },
  { key: 'analysing', label: 'Analysing for harmful substances', icon: '🔬' },
  { key: 'checking-bans', label: 'Checking country bans', icon: '🌍' },
  { key: 'finding-alternatives', label: 'Finding safer alternatives', icon: '🌿' },
  { key: 'generating-report', label: 'Generating report', icon: '📊' },
] as const;

function getStepStatus(stepKey: string, currentStep: ScanStep): 'pending' | 'active' | 'done' {
  const stepOrder = ['parsing', 'analysing', 'checking-bans', 'finding-alternatives', 'generating-report'];
  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(stepKey);

  if (currentStep === 'done') return 'done';
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

export default function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  if (currentStep === 'idle' || currentStep === 'done' || currentStep === 'error') return null;

  return (
    <div className="w-full max-w-lg mx-auto py-6 animate-pop-in" id="progress-indicator">
      <div className="brutal-card p-4 sm:p-6 bg-white border-4 border-brutal-black" style={{ boxShadow: 'var(--brutal-shadow-lg)' }}>
        <div className="flex justify-center items-center gap-2 sm:gap-3 mb-4 sm:mb-6 bg-brutal-yellow py-2 px-3 sm:px-4 border-2 border-brutal-black -rotate-1" style={{ boxShadow: 'var(--brutal-shadow)' }}>
          <div className="w-3 h-3 border-2 border-brutal-black bg-white animate-pulse" />
          <span className="text-sm sm:text-base font-black text-brutal-black uppercase tracking-widest">
            AI Pipeline Active
          </span>
        </div>

        <div className="space-y-4">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.key, currentStep);
          return (
             <div
              key={step.key}
              className={`flex items-center gap-4 px-4 py-3 border-4 transition-all duration-300 transform
                ${status === 'active' ? 'bg-brutal-green border-brutal-black scale-105 shadow-[4px_4px_0_0_#1A1A1A]' : 'border-brutal-black/20 bg-[#FDFBF7]'}
                ${status === 'done' ? 'bg-white border-brutal-black shadow-[2px_2px_0_0_#1A1A1A]' : ''}
              `}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Status icon */}
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white border-2 border-brutal-black shadow-[2px_2px_0_0_#1A1A1A]">
                {status === 'done' && (
                  <svg className="w-6 h-6 text-brutal-green drop-shadow-[1px_1px_0_#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {status === 'active' && (
                  <div className="w-5 h-5 border-4 border-brutal-black border-dashed rounded-full animate-spin-slow" />
                )}
                {status === 'pending' && (
                  <div className="w-3 h-3 border-2 border-brutal-black bg-[#E0E0E0]" />
                )}
              </div>

              {/* Step label */}
              <span className={`text-sm sm:text-lg font-black uppercase tracking-wide transition-colors
                ${status === 'active' ? 'text-brutal-black animate-bounce-slight inline-block' : ''}
                ${status === 'done' ? 'text-brutal-black' : ''}
                ${status === 'pending' ? 'text-gray-400' : ''}
              `}>
                <span className="drop-shadow-[1px_1px_0_#1A1A1A]">{step.icon}</span> {step.label}
              </span>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
