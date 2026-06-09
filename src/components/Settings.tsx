import { themes, applyTheme, saveThemeId, type Theme } from "../themes";

interface SettingsProps {
  currentThemeId: string;
  onThemeChange: (id: string) => void;
  onClose: () => void;
}

function ThemeCard({
  theme,
  isActive,
  onClick,
}: {
  theme: Theme;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border-2 transition-all duration-150 overflow-hidden ${
        isActive
          ? "border-accent shadow-md shadow-accent/20 scale-[1.02]"
          : "border-border-subtle hover:border-border-hover"
      }`}
    >
      {/* Mini preview */}
      <div
        className="p-3 h-[72px]"
        style={{ background: theme.colors.surface }}
      >
        {/* Fake search bar */}
        <div
          className="rounded-md h-5 mb-2"
          style={{ background: theme.colors.surfaceRaised, border: `1px solid ${theme.colors.borderSubtle}` }}
        />
        {/* Fake content lines */}
        <div className="flex gap-1.5">
          <div
            className="rounded h-2.5 w-8"
            style={{ background: theme.colors.accent, opacity: 0.6 }}
          />
          <div
            className="rounded h-2.5 flex-1"
            style={{ background: theme.colors.textSecondary, opacity: 0.3 }}
          />
        </div>
        <div className="flex gap-1.5 mt-1.5">
          <div
            className="rounded h-2.5 w-12"
            style={{ background: theme.colors.textMuted, opacity: 0.3 }}
          />
          <div
            className="rounded h-2.5 w-6"
            style={{ background: theme.colors.success, opacity: 0.4 }}
          />
        </div>
      </div>
      {/* Theme name */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ background: theme.colors.surfaceRaised }}>
        <span
          className="text-[13px] font-medium"
          style={{ color: theme.colors.textPrimary }}
        >
          {theme.name}
        </span>
        {isActive && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} style={{ color: theme.colors.accent }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
}

export default function Settings({ currentThemeId, onThemeChange, onClose }: SettingsProps) {
  const darkThemes = themes.filter((t) => t.group === "dark");
  const lightThemes = themes.filter((t) => t.group === "light");

  const handleSelect = (theme: Theme) => {
    applyTheme(theme);
    saveThemeId(theme.id);
    onThemeChange(theme.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
        <div>
          <h2 className="text-[17px] font-semibold text-text-primary">Appearance</h2>
          <p className="text-[13px] text-text-muted mt-0.5">Choose your theme</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Theme grid */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Dark themes */}
        <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-3">
          Dark Themes
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {darkThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={theme.id === currentThemeId}
              onClick={() => handleSelect(theme)}
            />
          ))}
        </div>

        {/* Light themes */}
        <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-3">
          Light Themes
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {lightThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={theme.id === currentThemeId}
              onClick={() => handleSelect(theme)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
