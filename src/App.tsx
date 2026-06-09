import { useState, useEffect } from "react";
import { useClips } from "./hooks/useClips";
import { applyTheme, getSavedThemeId, getThemeById } from "./themes";
import SearchBar from "./components/SearchBar";
import ClipCard from "./components/ClipCard";
import StatsBar from "./components/StatsBar";
import EmptyState from "./components/EmptyState";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [themeId, setThemeId] = useState(getSavedThemeId);

  useEffect(() => {
    applyTheme(getThemeById(themeId));
  }, [themeId]);

  const {
    clips, stats, sourceApps, folders,
    search, setSearch,
    contentType, setContentType,
    sourceApp, setSourceApp,
    folderId, setFolderId,
    favoritesOnly, setFavoritesOnly,
    copyToClipboard, toggleFavorite, deleteClip, clearAll,
    createFolder, renameFolder, deleteFolderById, moveClipToFolder,
  } = useClips();

  if (showSettings) {
    return (
      <Settings
        currentThemeId={themeId}
        onThemeChange={setThemeId}
        onClose={() => setShowSettings(false)}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Title bar */}
      <div data-tauri-drag-region className="h-12 flex items-center justify-between shrink-0 border-b border-border-subtle bg-surface/90 backdrop-blur-sm px-5">
        <div />
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-accent/20 flex items-center justify-center">
            <span className="text-[10px] font-bold text-accent">CS</span>
          </div>
          <span className="text-[13px] font-semibold text-text-secondary tracking-widest uppercase">
            ClipStash
          </span>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          title="Appearance"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </button>
      </div>

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          folders={folders}
          activeFolderId={folderId}
          onSelectFolder={setFolderId}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolderById}
          totalClips={stats?.total_entries ?? 0}
        />

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search & filters */}
          <SearchBar
            search={search}
            onSearchChange={setSearch}
            contentType={contentType}
            onContentTypeChange={setContentType}
            sourceApp={sourceApp}
            onSourceAppChange={setSourceApp}
            sourceApps={sourceApps}
            favoritesOnly={favoritesOnly}
            onFavoritesToggle={() => setFavoritesOnly(!favoritesOnly)}
            totalCount={clips.length}
          />

          {/* Folder context header */}
          {folderId !== null && (
            <div className="px-4 py-2 flex items-center gap-2 border-b border-border-subtle bg-surface-raised/50">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: folders.find((f) => f.id === folderId)?.color || "#818cf8" }}
              />
              <span className="text-[13px] font-medium text-text-primary">
                {folders.find((f) => f.id === folderId)?.name || "Folder"}
              </span>
              <button
                onClick={() => setFolderId(null)}
                className="ml-auto text-[11px] text-text-muted hover:text-text-secondary"
              >
                Clear filter
              </button>
            </div>
          )}

          {/* Clip grid */}
          <div className="flex-1 overflow-y-auto pt-3 pb-2 px-3">
            {clips.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {clips.map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    folders={folders}
                    onCopy={copyToClipboard}
                    onToggleFavorite={toggleFavorite}
                    onDelete={deleteClip}
                    onMoveToFolder={moveClipToFolder}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Status bar */}
          <StatsBar stats={stats} onClearAll={clearAll} />
        </div>
      </div>
    </div>
  );
}

export default App;
