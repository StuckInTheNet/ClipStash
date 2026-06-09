use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipEntry {
    pub id: i64,
    pub content_type: String,
    pub text_content: Option<String>,
    pub image_path: Option<String>,
    pub source_app: Option<String>,
    pub content_hash: String,
    pub preview: String,
    pub byte_size: i64,
    pub is_favorite: bool,
    pub is_sensitive: bool,
    pub category: Option<String>,
    pub folder_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: i64,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub clip_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClipStats {
    pub total_entries: i64,
    pub text_count: i64,
    pub image_count: i64,
    pub link_count: i64,
    pub favorites_count: i64,
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let db_path = Self::db_path()?;
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(&db_path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn db_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
        let data_dir = dirs::data_dir().ok_or("Could not find data directory")?;
        Ok(data_dir.join("ClipStash").join("clipstash.db"))
    }

    fn init_tables(&self) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                icon TEXT NOT NULL DEFAULT '📁',
                color TEXT NOT NULL DEFAULT '#818cf8',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS clips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_type TEXT NOT NULL DEFAULT 'text',
                text_content TEXT,
                image_path TEXT,
                source_app TEXT,
                content_hash TEXT NOT NULL,
                preview TEXT NOT NULL DEFAULT '',
                byte_size INTEGER NOT NULL DEFAULT 0,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                is_sensitive INTEGER NOT NULL DEFAULT 0,
                category TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_clips_created_at ON clips(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_clips_content_type ON clips(content_type);
            CREATE INDEX IF NOT EXISTS idx_clips_content_hash ON clips(content_hash);
            CREATE INDEX IF NOT EXISTS idx_clips_source_app ON clips(source_app);
            CREATE INDEX IF NOT EXISTS idx_clips_is_favorite ON clips(is_favorite);
            "
        )?;

        // Migration: add folder_id column if missing (existing DBs)
        let has_folder_id: bool = conn
            .prepare("SELECT folder_id FROM clips LIMIT 0")
            .is_ok();
        if !has_folder_id {
            conn.execute_batch(
                "ALTER TABLE clips ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;"
            )?;
        }

        // Create index after migration ensures column exists
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_clips_folder_id ON clips(folder_id);"
        )?;

        Ok(())
    }

    // ── Folder operations ──────────────────────────

    pub fn create_folder(&self, name: &str, icon: &str, color: &str) -> Result<Folder, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO folders (name, icon, color) VALUES (?1, ?2, ?3)",
            params![name, icon, color],
        )?;
        let id = conn.last_insert_rowid();
        let folder = conn.query_row(
            "SELECT id, name, icon, color, created_at FROM folders WHERE id = ?1",
            params![id],
            |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    color: row.get(3)?,
                    clip_count: 0,
                    created_at: row.get(4)?,
                })
            },
        )?;
        Ok(folder)
    }

    pub fn get_folders(&self) -> Result<Vec<Folder>, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT f.id, f.name, f.icon, f.color, f.created_at,
                    (SELECT COUNT(*) FROM clips WHERE folder_id = f.id) as clip_count
             FROM folders f ORDER BY f.name"
        )?;
        let folders = stmt.query_map([], |row| {
            Ok(Folder {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
                clip_count: row.get(5)?,
            })
        })?;
        let mut result = Vec::new();
        for f in folders {
            result.push(f?);
        }
        Ok(result)
    }

    pub fn rename_folder(&self, id: i64, name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE folders SET name = ?1 WHERE id = ?2", params![name, id])?;
        Ok(())
    }

    pub fn delete_folder(&self, id: i64) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        // Unassign clips first (don't delete them)
        conn.execute("UPDATE clips SET folder_id = NULL WHERE folder_id = ?1", params![id])?;
        conn.execute("DELETE FROM folders WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn move_clip_to_folder(&self, clip_id: i64, folder_id: Option<i64>) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE clips SET folder_id = ?1 WHERE id = ?2", params![folder_id, clip_id])?;
        Ok(())
    }

    // ── Clip operations ────────────────────────────

    pub fn insert_clip(
        &self,
        content_type: &str,
        text_content: Option<&str>,
        image_path: Option<&str>,
        source_app: Option<&str>,
        content_hash: &str,
        preview: &str,
        byte_size: i64,
        is_sensitive: bool,
    ) -> Result<i64, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        let last_hash: Option<String> = conn
            .query_row("SELECT content_hash FROM clips ORDER BY id DESC LIMIT 1", [], |row| row.get(0))
            .ok();
        if last_hash.as_deref() == Some(content_hash) {
            return Ok(-1);
        }
        conn.execute(
            "INSERT INTO clips (content_type, text_content, image_path, source_app, content_hash, preview, byte_size, is_sensitive)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![content_type, text_content, image_path, source_app, content_hash, preview, byte_size, is_sensitive as i32],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_clips(
        &self,
        search: Option<&str>,
        content_type: Option<&str>,
        source_app: Option<&str>,
        folder_id: Option<i64>,
        favorites_only: bool,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ClipEntry>, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        let mut query = String::from(
            "SELECT id, content_type, text_content, image_path, source_app, content_hash,
                    preview, byte_size, is_favorite, is_sensitive, category, folder_id, created_at
             FROM clips WHERE 1=1"
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(s) = search {
            if !s.is_empty() {
                query.push_str(" AND (text_content LIKE ?1 OR preview LIKE ?1)");
                param_values.push(Box::new(format!("%{}%", s)));
            }
        }
        if let Some(ct) = content_type {
            if !ct.is_empty() {
                let idx = param_values.len() + 1;
                query.push_str(&format!(" AND content_type = ?{}", idx));
                param_values.push(Box::new(ct.to_string()));
            }
        }
        if let Some(app) = source_app {
            if !app.is_empty() {
                let idx = param_values.len() + 1;
                query.push_str(&format!(" AND source_app = ?{}", idx));
                param_values.push(Box::new(app.to_string()));
            }
        }
        if let Some(fid) = folder_id {
            let idx = param_values.len() + 1;
            query.push_str(&format!(" AND folder_id = ?{}", idx));
            param_values.push(Box::new(fid));
        }
        if favorites_only {
            query.push_str(" AND is_favorite = 1");
        }

        let limit_idx = param_values.len() + 1;
        let offset_idx = param_values.len() + 2;
        query.push_str(&format!(" ORDER BY created_at DESC LIMIT ?{} OFFSET ?{}", limit_idx, offset_idx));
        param_values.push(Box::new(limit));
        param_values.push(Box::new(offset));

        let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&query)?;
        let entries = stmt.query_map(params_ref.as_slice(), |row| {
            Ok(ClipEntry {
                id: row.get(0)?,
                content_type: row.get(1)?,
                text_content: row.get(2)?,
                image_path: row.get(3)?,
                source_app: row.get(4)?,
                content_hash: row.get(5)?,
                preview: row.get(6)?,
                byte_size: row.get(7)?,
                is_favorite: row.get::<_, i32>(8)? != 0,
                is_sensitive: row.get::<_, i32>(9)? != 0,
                category: row.get(10)?,
                folder_id: row.get(11)?,
                created_at: row.get(12)?,
            })
        })?;
        let mut result = Vec::new();
        for entry in entries {
            result.push(entry?);
        }
        Ok(result)
    }

    pub fn toggle_favorite(&self, id: i64) -> Result<bool, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE clips SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?1",
            params![id],
        )?;
        let is_fav: bool = conn.query_row(
            "SELECT is_favorite FROM clips WHERE id = ?1", params![id],
            |row| row.get::<_, i32>(0).map(|v| v != 0),
        )?;
        Ok(is_fav)
    }

    pub fn delete_clip(&self, id: i64) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM clips WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn clear_all(&self) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM clips", [])?;
        Ok(())
    }

    pub fn get_stats(&self) -> Result<ClipStats, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        let total: i64 = conn.query_row("SELECT COUNT(*) FROM clips", [], |r| r.get(0))?;
        let text: i64 = conn.query_row("SELECT COUNT(*) FROM clips WHERE content_type = 'text'", [], |r| r.get(0))?;
        let image: i64 = conn.query_row("SELECT COUNT(*) FROM clips WHERE content_type = 'image'", [], |r| r.get(0))?;
        let link: i64 = conn.query_row("SELECT COUNT(*) FROM clips WHERE content_type = 'link'", [], |r| r.get(0))?;
        let favs: i64 = conn.query_row("SELECT COUNT(*) FROM clips WHERE is_favorite = 1", [], |r| r.get(0))?;
        Ok(ClipStats { total_entries: total, text_count: text, image_count: image, link_count: link, favorites_count: favs })
    }

    pub fn get_source_apps(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT DISTINCT source_app FROM clips WHERE source_app IS NOT NULL ORDER BY source_app"
        )?;
        let apps = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut result = Vec::new();
        for app in apps {
            result.push(app?);
        }
        Ok(result)
    }
}
