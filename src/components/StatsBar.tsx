import { useState } from "react";
import type { ClipStats } from "../hooks/useClips";

interface StatsBarProps {
  stats: ClipStats | null;
  onClearAll: () => void;
}

export default function StatsBar({ stats, onClearAll }: StatsBarProps) {
  const [confirming, setConfirming] = useState(false);

  if (!stats) return null;

  const handleClear = () => {
    onClearAll();
    setConfirming(false);
  };

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
        confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-danger font-medium">Delete all {stats.total_entries} clips?</span>
            <button
              onClick={handleClear}
              className="text-[12px] text-white bg-danger px-2.5 py-1 rounded-lg font-medium hover:brightness-110 transition-all"
            >
              Yes, clear
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-[12px] text-text-muted px-2 py-1 rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-[12px] text-text-muted hover:text-danger font-medium px-2.5 py-1 rounded-lg hover:bg-danger/5 transition-colors"
          >
            Clear all
          </button>
        )
      )}
    </div>
  );
}
