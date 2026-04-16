import { useState } from 'react';
import { HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface InfoCardProps {
  id: string;
  title: string;
  description: string;
  learnMore?: string;
}

export function InfoCard({ id, title, description, learnMore }: InfoCardProps) {
  const storageKey = `unclick_dismissed_${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  const [expanded, setExpanded] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-4 py-3 mb-4">
      <div className="flex items-start gap-2">
        <HelpCircle size={14} className="mt-0.5 shrink-0" style={{ color: '#61C1C4' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white/70">{title}</span>
            <button
              onClick={() => { setDismissed(true); try { localStorage.setItem(storageKey, '1'); } catch {} }}
              className="text-white/20 hover:text-white/40 p-0.5"
            >
              <X size={12} />
            </button>
          </div>
          <p className="text-sm text-white/50 mt-1">{description}</p>
          {learnMore && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-white/30 hover:text-white/50 mt-2 flex items-center gap-1"
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Less' : 'Learn more'}
              </button>
              {expanded && <p className="text-sm text-white/40 mt-2">{learnMore}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
