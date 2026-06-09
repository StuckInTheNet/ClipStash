import { useRef, useEffect } from "react";

interface SearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  contentType: string;
  onContentTypeChange: (value: string) => void;
  sourceApp: string;
  onSourceAppChange: (value: string) => void;
  sourceApps: string[];
  favoritesOnly: boolean;
  onFavoritesToggle: () => void;
  totalCount: number;
}

const CONTENT_TYPES = [
  { value: "", label: "All", icon: "⊡" },
  { value: "text", label: "Text", icon: "T" },
  { value: "link", label: "Links", icon: "↗" },
  { value: "code", label: "Code", icon: "⟨⟩" },
  { value: "color", label: "Colors", icon: "◉" },
  { value: "image", label: "Images", icon: "▣" },
];

export default function SearchBar({
  search,
  onSearchChange,
  contentType,
  onContentTypeChange,
  sourceApp,
  onSourceAppChange,
  sourceApps,
  favoritesOnly,
  onFavoritesToggle,
  totalCount,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
        onSearchChange("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSearchChange]);

  return (
    <div className="px-5 pt-3 pb-3 space-y-3 glass sticky top-0 z-10 border-b border-border-subtle">
      {/* Search input */}
      <div className="relative group">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search clips..."
          className="w-full bg-surface-raised border border-border-subtle rounded-xl pl-11 pr-16 py-3 text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 focus:bg-surface-hover transition-all duration-200"
        />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="text-text-muted hover:text-text-secondary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <kbd className="hidden sm:inline text-[11px] text-text-muted bg-surface/60 border border-border-subtle rounded px-1.5 py-0.5 font-mono">
            ⌘F
          </kbd>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 flex-1 flex-wrap">
          {CONTENT_TYPES.map((ct) => {
            const isActive = ct.value === contentType;
            return (
              <button
                key={ct.value}
                onClick={() => onContentTypeChange(ct.value === contentType ? "" : ct.value)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[13px] rounded-lg whitespace-nowrap transition-all duration-150 font-medium ${
                  isActive
                    ? "bg-accent text-white shadow-sm shadow-accent/25"
                    : "bg-surface-raised text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                }`}
              >
                <span className={`text-[12px] ${isActive ? "opacity-90" : "opacity-60"}`}>{ct.icon}</span>
                {ct.label}
              </button>
            );
          })}
        </div>

        {/* Favorites */}
        <button
          onClick={onFavoritesToggle}
          className={`flex items-center gap-1 px-2.5 py-2 rounded-lg transition-all duration-150 ${
            favoritesOnly
              ? "bg-warning/15 text-warning"
              : "text-text-muted hover:text-text-secondary hover:bg-surface-raised"
          }`}
          title="Favorites"
        >
          <svg className="w-4 h-4" fill={favoritesOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>

        {/* Source app dropdown */}
        {sourceApps.length > 0 && (
          <select
            value={sourceApp}
            onChange={(e) => onSourceAppChange(e.target.value)}
            className="bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-2 text-[13px] text-text-secondary focus:outline-none focus:border-accent/40 cursor-pointer max-w-[120px]"
          >
            <option value="">All apps</option>
            {sourceApps.map((app) => (
              <option key={app} value={app}>{app}</option>
            ))}
          </select>
        )}
      </div>

      {/* Result count */}
      {(search || contentType || favoritesOnly) && (
        <div className="text-[12px] text-text-muted px-0.5">
          {totalCount} {totalCount === 1 ? "result" : "results"}
          {search && <span> for &ldquo;{search}&rdquo;</span>}
        </div>
      )}
    </div>
  );
}
