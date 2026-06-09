mod clipboard;
mod db;

use db::{ClipEntry, ClipStats, Database, Folder};
use std::sync::Arc;
use tauri::{Manager, State};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

struct AppState {
    db: Arc<Database>,
}

// ── Clip commands ──────────────────────────────

#[tauri::command]
fn get_clips(
    state: State<AppState>,
    search: Option<String>,
    content_type: Option<String>,
    source_app: Option<String>,
    folder_id: Option<i64>,
    favorites_only: Option<bool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<ClipEntry>, String> {
    state.db.get_clips(
        search.as_deref(),
        content_type.as_deref(),
        source_app.as_deref(),
        folder_id,
        favorites_only.unwrap_or(false),
        limit.unwrap_or(50),
        offset.unwrap_or(0),
    ).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_favorite(state: State<AppState>, id: i64) -> Result<bool, String> {
    state.db.toggle_favorite(id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_clip(state: State<AppState>, id: i64) -> Result<(), String> {
    state.db.delete_clip(id).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_all(state: State<AppState>) -> Result<(), String> {
    state.db.clear_all().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_stats(state: State<AppState>) -> Result<ClipStats, String> {
    state.db.get_stats().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_source_apps(state: State<AppState>) -> Result<Vec<String>, String> {
    state.db.get_source_apps().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_image_base64(path: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/png;base64,{}", b64))
}

#[tauri::command]
fn copy_to_clipboard(text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let mut child = Command::new("pbcopy")
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;
        if let Some(stdin) = child.stdin.as_mut() {
            use std::io::Write;
            stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        }
        child.wait().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("powershell")
            .args(["-command", &format!("Set-Clipboard -Value '{}'", text.replace('\'', "''"))])
            .output()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn move_clip_to_folder(state: State<AppState>, clip_id: i64, folder_id: Option<i64>) -> Result<(), String> {
    state.db.move_clip_to_folder(clip_id, folder_id).map_err(|e| e.to_string())
}

// ── Folder commands ────────────────────────────

#[tauri::command]
fn get_folders(state: State<AppState>) -> Result<Vec<Folder>, String> {
    state.db.get_folders().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_folder(state: State<AppState>, name: String, icon: String, color: String) -> Result<Folder, String> {
    state.db.create_folder(&name, &icon, &color).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_folder(state: State<AppState>, id: i64, name: String) -> Result<(), String> {
    state.db.rename_folder(id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_folder(state: State<AppState>, id: i64) -> Result<(), String> {
    state.db.delete_folder(id).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Arc::new(Database::new().expect("Failed to initialize database"));
    clipboard::start_monitor(Arc::clone(&db));

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState { db })
        .invoke_handler(tauri::generate_handler![
            get_clips,
            toggle_favorite,
            delete_clip,
            clear_all,
            get_stats,
            get_source_apps,
            get_image_base64,
            copy_to_clipboard,
            move_clip_to_folder,
            get_folders,
            create_folder,
            rename_folder,
            delete_folder,
        ])
        .setup(|app| {
            use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};
            let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyV);
            let app_handle = app.handle().clone();
            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            })?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ClipStash");
}
