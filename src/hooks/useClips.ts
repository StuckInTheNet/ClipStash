import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ClipEntry {
  id: number;
  content_type: string;
  text_content: string | null;
  image_path: string | null;
  source_app: string | null;
  content_hash: string;
  preview: string;
  byte_size: number;
  is_favorite: boolean;
  is_sensitive: boolean;
  category: string | null;
  folder_id: number | null;
  created_at: string;
}

export interface ClipStats {
  total_entries: number;
  text_count: number;
  image_count: number;
  link_count: number;
  favorites_count: number;
}

export interface Folder {
  id: number;
  name: string;
  icon: string;
  color: string;
  clip_count: number;
  created_at: string;
}

export function useClips() {
  const [clips, setClips] = useState<ClipEntry[]>([]);
  const [stats, setStats] = useState<ClipStats | null>(null);
  const [sourceApps, setSourceApps] = useState<string[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [search, setSearch] = useState("");
  const [contentType, setContentType] = useState<string>("");
  const [sourceApp, setSourceApp] = useState<string>("");
  const [folderId, setFolderId] = useState<number | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchClips = useCallback(async () => {
    try {
      setLoading(true);
      const result = await invoke<ClipEntry[]>("get_clips", {
        search: search || null,
        contentType: contentType || null,
        sourceApp: sourceApp || null,
        folderId,
        favoritesOnly,
        limit: 200,
        offset: 0,
      });
      setClips(result);
    } catch (err) {
      console.error("Failed to fetch clips:", err);
    } finally {
      setLoading(false);
    }
  }, [search, contentType, sourceApp, folderId, favoritesOnly]);

  const fetchStats = useCallback(async () => {
    try {
      const result = await invoke<ClipStats>("get_stats");
      setStats(result);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const fetchSourceApps = useCallback(async () => {
    try {
      const result = await invoke<string[]>("get_source_apps");
      setSourceApps(result);
    } catch (err) {
      console.error("Failed to fetch source apps:", err);
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const result = await invoke<Folder[]>("get_folders");
      setFolders(result);
    } catch (err) {
      console.error("Failed to fetch folders:", err);
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await invoke("copy_to_clipboard", { text });
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  const toggleFavorite = useCallback(async (id: number) => {
    try {
      await invoke("toggle_favorite", { id });
      await fetchClips();
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  }, [fetchClips]);

  const deleteClip = useCallback(async (id: number) => {
    try {
      await invoke("delete_clip", { id });
      await fetchClips();
      await fetchStats();
      await fetchFolders();
    } catch (err) {
      console.error("Failed to delete clip:", err);
    }
  }, [fetchClips, fetchStats, fetchFolders]);

  const clearAll = useCallback(async () => {
    try {
      await invoke("clear_all");
      await fetchClips();
      await fetchStats();
      await fetchFolders();
    } catch (err) {
      console.error("Failed to clear all:", err);
    }
  }, [fetchClips, fetchStats, fetchFolders]);

  const createFolder = useCallback(async (name: string, icon: string, color: string) => {
    try {
      await invoke("create_folder", { name, icon, color });
      await fetchFolders();
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  }, [fetchFolders]);

  const renameFolder = useCallback(async (id: number, name: string) => {
    try {
      await invoke("rename_folder", { id, name });
      await fetchFolders();
    } catch (err) {
      console.error("Failed to rename folder:", err);
    }
  }, [fetchFolders]);

  const deleteFolderById = useCallback(async (id: number) => {
    try {
      await invoke("delete_folder", { id });
      if (folderId === id) setFolderId(null);
      await fetchFolders();
      await fetchClips();
    } catch (err) {
      console.error("Failed to delete folder:", err);
    }
  }, [fetchFolders, fetchClips, folderId]);

  const moveClipToFolder = useCallback(async (clipId: number, targetFolderId: number | null) => {
    try {
      await invoke("move_clip_to_folder", { clipId, folderId: targetFolderId });
      await fetchClips();
      await fetchFolders();
    } catch (err) {
      console.error("Failed to move clip:", err);
    }
  }, [fetchClips, fetchFolders]);

  useEffect(() => {
    fetchClips();
    fetchStats();
    fetchSourceApps();
    fetchFolders();

    pollRef.current = setInterval(() => {
      fetchClips();
      fetchStats();
      fetchSourceApps();
      fetchFolders();
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchClips, fetchStats, fetchSourceApps, fetchFolders]);

  return {
    clips, stats, sourceApps, folders,
    search, setSearch,
    contentType, setContentType,
    sourceApp, setSourceApp,
    folderId, setFolderId,
    favoritesOnly, setFavoritesOnly,
    loading,
    copyToClipboard, toggleFavorite, deleteClip, clearAll,
    createFolder, renameFolder, deleteFolderById, moveClipToFolder,
  };
}
