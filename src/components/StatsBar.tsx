import type { ClipStats } from "../hooks/useClips";

interface StatsBarProps {
  stats: ClipStats | null;
  onClearAll: () => void;
}

export default function StatsBar({ stats, onClearAll }: StatsBarProps) {
  if (!stats) return null;

  return (
    <div className="px-5 py-3 flex items-center justify-between border-t border-border-subtle bg-surface/90 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
          <span className="text-[12px] text-text-muted font-medium">Monitoring</span>
        </div>
        <span className="text-border-subtle">|</span>
        <div className="flex gap-3 text-[12px] text-text-secondary tabular-nums">
          <span>{stats.total_entries} clips</span>
          {stats.favorites_count > 0 && (
            <span className="text-warning/80">{stats.favorites_count} starred</span>
          )}
        </div>
      </div>

      {stats.total_entries > 0 && (
        <button
          onClick={() => { if (window.confirm(`Delete all ${stats.total_entries} clips? This cannot be undone.`)) onClearAll(); }}
          className="text-[12px] text-text-muted hover:text-danger font-medium px-2.5 py-1 rounded-lg hover:bg-danger/5 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
