import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClipEntry, Folder } from "../hooks/useClips";

interface ClipCardProps {
  clip: ClipEntry;
  folders: Folder[];
  onCopy: (text: string) => void;
  onToggleFavorite: (id: number) => void;
  onDelete: (id: number) => void;
  onMoveToFolder: (clipId: number, folderId: number | null) => void;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr + "Z");
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 10) return "now";
  if (diffSec < 60) return `${diffSec}s`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  text: { icon: "T", label: "Text", color: "text-blue-300", bg: "bg-blue-500/15" },
  link: { icon: "↗", label: "Link", color: "text-emerald-300", bg: "bg-emerald-500/15" },
  code: { icon: "⟨⟩", label: "Code", color: "text-amber-300", bg: "bg-amber-500/15" },
  color: { icon: "◉", label: "Color", color: "text-purple-300", bg: "bg-purple-500/15" },
  image: { icon: "▣", label: "Image", color: "text-pink-300", bg: "bg-pink-500/15" },
};

export default function ClipCard({ clip, folders, onCopy, onToggleFavorite, onDelete, onMoveToFolder }: ClipCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  // Close folder menu on click outside
  useEffect(() => {
    if (!showFolderMenu) return;
    const handler = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setShowFolderMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showFolderMenu]);

  const config = TYPE_CONFIG[clip.content_type] || TYPE_CONFIG.text;
  const isLong = (clip.text_content?.length ?? 0) > 200;
  const isColor = clip.content_type === "color" && clip.text_content;
  const isImage = clip.content_type === "image" && clip.image_path;

  useEffect(() => {
    if (isImage && clip.image_path) {
      invoke<string>("get_image_base64", { path: clip.image_path })
        .then(setImageSrc)
        .catch(() => setImageSrc(null));
    }
  }, [isImage, clip.image_path]);

  const handleCopy = () => {
    if (clip.text_content) {
      onCopy(clip.text_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      className="group rounded-xl border border-border-subtle hover:border-border-hover bg-surface-raised hover:bg-surface-hover transition-all duration-150 cursor-pointer animate-slide-up"
      onClick={handleCopy}
    >
      <div className="p-4">
        {/* Top row: type badge + meta */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[12px] font-bold ${config.bg} ${config.color}`}>
              {config.icon}
            </span>
            {clip.source_app && (
              <span className="text-[12px] text-text-muted truncate max-w-[120px]">
                {clip.source_app}
              </span>
            )}
            {clip.is_sensitive && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-danger/10 text-danger px-2 py-0.5 rounded-full font-medium">
                sensitive
              </span>
            )}
            {clip.is_favorite && (
              <svg className="w-4 h-4 text-warning fill-warning" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            )}
          </div>
          <span className="text-[12px] text-text-muted tabular-nums shrink-0 ml-2">
            {timeAgo(clip.created_at)}
          </span>
        </div>

        {/* Content */}
        {isImage ? (
          <div className="rounded-lg overflow-hidden border border-border-subtle bg-black/20">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt="Screenshot"
                className="w-full max-h-[200px] object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-20 text-text-muted text-sm">
                Loading image...
              </div>
            )}
          </div>
        ) : isColor ? (
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg border border-border-subtle shadow-inner"
              style={{ backgroundColor: clip.text_content! }}
            />
            <div>
              <span className="text-[15px] font-mono text-text-primary">{clip.text_content}</span>
              <span className="block text-[12px] text-text-muted mt-0.5">Color value</span>
            </div>
          </div>
        ) : (
          <div className="relative">
            <pre
              className={`text-[14px] leading-[1.7] whitespace-pre-wrap break-words ${
                clip.content_type === "code"
                  ? "font-mono text-[13px] bg-code-bg rounded-lg p-3 text-code-text border border-border-subtle"
                  : clip.content_type === "link"
                  ? "text-accent hover:text-accent-hover font-sans"
                  : "text-text-secondary font-sans"
              } ${!expanded && isLong ? "max-h-[100px] overflow-hidden" : ""}`}
            >
              {clip.is_sensitive && !expanded ? "••••••••••••••••••••" : clip.text_content}
            </pre>
            {isLong && !expanded && (
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-surface-raised to-transparent" />
            )}
          </div>
        )}

        {isLong && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-[13px] text-accent/80 hover:text-accent mt-2 font-medium"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-transparent group-hover:border-border-subtle transition-all duration-150">
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(clip.id); }}
              className={`p-2 rounded-lg transition-colors ${
                clip.is_favorite ? "text-warning hover:bg-warning/10" : "text-text-muted hover:text-warning hover:bg-warning/5"
              }`}
              title="Favorite"
            >
              <svg className="w-4 h-4" fill={clip.is_favorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
            {/* Move to folder */}
            <div className="relative" ref={folderMenuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowFolderMenu(!showFolderMenu); }}
                className={`p-2 rounded-lg transition-colors ${
                  clip.folder_id ? "text-accent" : "text-text-muted hover:text-accent hover:bg-accent/5"
                }`}
                title="Move to folder"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
              {showFolderMenu && (
                <div
                  className="absolute bottom-full left-0 mb-1 w-44 bg-surface-raised border border-border-subtle rounded-lg shadow-xl py-1 z-20 animate-slide-up"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { onMoveToFolder(clip.id, null); setShowFolderMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-surface-hover transition-colors ${
                      !clip.folder_id ? "text-accent font-medium" : "text-text-secondary"
                    }`}
                  >
                    No folder
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { onMoveToFolder(clip.id, f.id); setShowFolderMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-surface-hover transition-colors flex items-center gap-2 ${
                        clip.folder_id === f.id ? "text-accent font-medium" : "text-text-secondary"
                      }`}
                    >
                      <span>{f.icon}</span>
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                  {folders.length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-text-muted">Create a folder first</p>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(clip.id); }}
              className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/5 transition-colors"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          <div className={`flex items-center gap-1.5 text-[13px] font-medium transition-all duration-200 ${
            copied ? "text-success" : "text-text-muted opacity-0 group-hover:opacity-60"
          }`}>
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
