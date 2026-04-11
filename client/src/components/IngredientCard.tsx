import type { AnalysedIngredient } from '../types';

interface IngredientCardProps {
  ingredient: AnalysedIngredient;
  index: number;
}

const SEVERITY_CONFIG = {
  safe: { label: 'SAFE', class: 'severity-safe', icon: '✓' },
  low: { label: 'LOW', class: 'severity-low', icon: '⚠' },
  medium: { label: 'MEDIUM', class: 'severity-medium', icon: '⚠' },
  high: { label: 'HIGH', class: 'severity-high', icon: '✕' },
} as const;

const COUNTRY_FLAGS: Record<string, string> = {
  USA: '🇺🇸',
  India: '🇮🇳',
  EU: '🇪🇺',
  Canada: '🇨🇦',
  Australia: '🇦🇺',
  UK: '🇬🇧',
};

export default function IngredientCard({ ingredient, index }: IngredientCardProps) {
  const config = SEVERITY_CONFIG[ingredient.severity];

  return (
    <div
      className="brutal-card-hover p-6 stagger-item bg-white"
      style={{ animationDelay: `${index * 80}ms` }}
      id={`ingredient-card-${index}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Header: Name + Severity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-2xl font-black text-brutal-black uppercase truncate border-b-4 border-brutal-black pb-1">
              {ingredient.ingredient}
            </h3>
            <span className={`brutal-badge ${config.class}`}>
              {config.icon} {config.label}
            </span>
          </div>

          {/* Category */}
          <span className="inline-block mt-3 font-bold text-xs text-brutal-black bg-[#E0E0E0] border-2 border-brutal-black px-2 py-0.5 rounded-md uppercase tracking-wider">
            {ingredient.category}
          </span>

          {/* Reason */}
          {ingredient.severity !== 'safe' && (
            <p className="mt-4 text-base font-medium text-brutal-black bg-[#FDFBF7] p-3 border-l-4 border-brutal-black">
              {ingredient.reason}
            </p>
          )}

          {/* Bans */}
          {ingredient.bans && ingredient.bans.length > 0 && (
            <div className="mt-5 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-brutal-black font-black uppercase bg-brutal-yellow px-2 py-1 border-2 border-brutal-black -rotate-2">Banned in:</span>
              {ingredient.bans.map((country) => (
                <span
                  key={country}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-bold border-2 border-brutal-black shadow-[2px_2px_0_0_#1A1A1A]
                    ${ingredient.bannedInSelected && country === ingredient.bans[0]
                      ? 'bg-brutal-red text-white border-white'
                      : 'bg-white text-brutal-black'
                    }
                  `}
                >
                  {COUNTRY_FLAGS[country] || '🏳️'} {country}
                </span>
              ))}
            </div>
          )}

          {/* Substitute */}
          {ingredient.substitute && (
            <div className="mt-6 flex flex-col gap-2 bg-brutal-green border-4 border-brutal-black p-4 shadow-[4px_4px_0_0_#1A1A1A] hover:translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#1A1A1A] transition-all">
              <div className="flex items-center gap-2">
                <span className="bg-white border-2 border-brutal-black rounded-full px-2 py-1 text-xl drop-shadow-[1px_1px_0_#1A1A1A]">💡</span>
                <span className="text-lg font-black text-brutal-black uppercase tracking-widest bg-white px-2 border-2 border-brutal-black">
                  Healthier Alternative
                </span>
              </div>
              <p className="text-base font-bold text-brutal-black mt-2 p-2 bg-white border-2 border-brutal-black">
                {ingredient.substitute}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
