import { useState } from "react";
import type { Folder } from "../hooks/useClips";

interface SidebarProps {
  folders: Folder[];
  activeFolderId: number | null;
  onSelectFolder: (id: number | null) => void;
  onCreateFolder: (name: string, icon: string, color: string) => void;
  onRenameFolder: (id: number, name: string) => void;
  onDeleteFolder: (id: number) => void;
  totalClips: number;
}

const FOLDER_COLORS = [
  "#818cf8", "#f472b6", "#fb923c", "#34d399",
  "#fbbf24", "#60a5fa", "#a78bfa", "#f87171",
];

export default function Sidebar({
  folders,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  totalClips,
}: SidebarProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(FOLDER_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = () => {
    if (newName.trim()) {
      onCreateFolder(newName.trim(), "", newColor);
      setNewName("");
      setNewColor(FOLDER_COLORS[0]);
      setShowCreate(false);
    }
  };

  const handleRename = (id: number) => {
    if (editName.trim()) {
      onRenameFolder(id, editName.trim());
      setEditingId(null);
    }
  };

  return (
    <div className="w-[220px] shrink-0 border-r border-border-subtle bg-surface flex flex-col h-full">
      <div className="p-4 space-y-1">
        {/* All clips */}
        <button
          onClick={() => onSelectFolder(null)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px] transition-colors ${
            activeFolderId === null
              ? "bg-accent/15 text-accent font-medium"
              : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          <span>All Clips</span>
          <span className="text-[12px] text-text-muted tabular-nums">{totalClips}</span>
        </button>
      </div>

      {/* Divider + folders header */}
      <div className="px-4 pb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Folders</span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Create folder */}
      {showCreate && (
        <div className="mx-4 mb-3 p-4 bg-surface-raised rounded-xl border border-border-subtle animate-slide-up">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setShowCreate(false); setNewName(""); }
            }}
            placeholder="Folder name"
            autoFocus
            className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 mb-3"
          />
          <div className="flex gap-2.5 mb-4">
            {FOLDER_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={`w-5 h-5 rounded-full transition-all ${
                  newColor === color ? "scale-[1.3] ring-2 ring-offset-2 ring-offset-surface-raised" : "opacity-60 hover:opacity-100 hover:scale-110"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="flex-1 bg-accent text-white text-[13px] font-medium py-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(""); }}
              className="px-4 text-text-muted text-[13px] py-2 rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Folder list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {folders.length === 0 && !showCreate && (
          <p className="text-[13px] text-text-muted text-center py-8 leading-relaxed">
            No folders yet
          </p>
        )}
        <div className="space-y-0.5">
          {folders.map((folder) => (
            <div key={folder.id} className="group">
              {editingId === folder.id ? (
                <div className="flex items-center gap-1.5 py-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(folder.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="flex-1 bg-surface border border-accent/40 rounded-lg px-2.5 py-1.5 text-[13px] text-text-primary focus:outline-none min-w-0"
                  />
                  <button onClick={() => handleRename(folder.id)} className="p-1.5 text-success hover:bg-success/10 rounded-md">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onSelectFolder(folder.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px] transition-colors ${
                    activeFolderId === folder.id
                      ? "bg-accent/15 text-accent font-medium"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: folder.color }} />
                    <span className="truncate">{folder.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] text-text-muted tabular-nums group-hover:hidden">{folder.clip_count}</span>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingId(folder.id); setEditName(folder.name); }}
                        className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                        className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-danger/10"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
