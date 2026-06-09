use sha2::{Sha256, Digest};
use std::sync::Arc;
use std::time::Duration;
use std::path::PathBuf;
use crate::db::Database;

/// Detects the content type from text content
fn detect_content_type(text: &str) -> &'static str {
    let trimmed = text.trim();

    if trimmed.starts_with("http://") || trimmed.starts_with("https://") || trimmed.starts_with("www.") {
        return "link";
    }

    if trimmed.starts_with('#') && (trimmed.len() == 4 || trimmed.len() == 7 || trimmed.len() == 9) {
        if trimmed[1..].chars().all(|c| c.is_ascii_hexdigit()) {
            return "color";
        }
    }

    if trimmed.starts_with("rgb") || trimmed.starts_with("hsl") {
        return "color";
    }

    let code_indicators = [
        "fn ", "func ", "function ", "def ", "class ", "import ", "const ", "let ", "var ",
        "pub ", "async ", "await ", "return ", "if (", "for (", "while (",
        "=>", "->", "::", "&&", "||", "!=", "===", "!==",
        "{", "}", "();", ");", "/**",
    ];
    let indicator_count = code_indicators.iter().filter(|&&ind| trimmed.contains(ind)).count();
    if indicator_count >= 2 {
        return "code";
    }

    "text"
}

fn is_sensitive_content(text: &str) -> bool {
    let lower = text.to_lowercase();
    let sensitive_patterns = [
        "password", "passwd", "secret", "api_key", "apikey", "api-key",
        "token", "bearer ", "authorization:", "private_key", "ssh-rsa",
        "-----begin", "aws_access", "aws_secret",
    ];
    sensitive_patterns.iter().any(|&pattern| lower.contains(pattern))
}

fn make_preview(text: &str, max_chars: usize) -> String {
    let single_line = text.lines().next().unwrap_or("").trim();
    if single_line.chars().count() > max_chars {
        let truncated: String = single_line.chars().take(max_chars).collect();
        format!("{}...", truncated)
    } else {
        single_line.to_string()
    }
}

fn hash_content(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    format!("{:x}", hasher.finalize())
}

/// Get the images directory for storing clipboard images
fn images_dir() -> Option<PathBuf> {
    let data_dir = dirs::data_dir()?;
    let dir = data_dir.join("ClipStash").join("images");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

#[cfg(target_os = "macos")]
fn get_frontmost_app() -> Option<String> {
    use std::process::Command;
    let output = Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to get name of first application process whose frontmost is true")
        .output()
        .ok()?;
    if output.status.success() {
        let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !name.is_empty() {
            return Some(name);
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn get_frontmost_app() -> Option<String> {
    None
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn get_frontmost_app() -> Option<String> {
    None
}

/// Single JXA call: check change count, detect type, and save image if needed.
/// Returns: "SAME" | "TEXT" | "IMAGE:/path/to/saved.png" | "EMPTY"
#[cfg(target_os = "macos")]
fn poll_clipboard(last_count: i64, save_dir: &str) -> Option<(i64, String)> {
    use std::process::Command;
    let script = format!(
        r#"ObjC.import('AppKit');
var pb = $.NSPasteboard.generalPasteboard;
var cc = pb.changeCount;
if (cc == {}) {{ "SAME"; }} else {{
  var types = pb.types.js.map(function(t) {{ return t.js; }});
  var hasImage = types.some(function(t) {{ return t.indexOf('tiff') >= 0 || t.indexOf('png') >= 0; }});
  var hasText = types.some(function(t) {{ return t.indexOf('string') >= 0 || t.indexOf('utf8') >= 0; }});
  if (hasImage) {{
    var imgData = pb.dataForType($.NSPasteboardTypeTIFF);
    if (!imgData.isNil()) {{
      var rep = $.NSBitmapImageRep.imageRepWithData(imgData);
      var png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());
      var ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 17);
      var path = '{}/' + 'clip_' + ts + '.png';
      png.writeToFileAtomically(path, true);
      cc + '|IMAGE:' + path;
    }} else {{ cc + '|EMPTY'; }}
  }} else if (hasText) {{
    cc + '|TEXT';
  }} else {{
    cc + '|EMPTY';
  }}
}}"#,
        last_count, save_dir
    );

    let output = Command::new("osascript")
        .arg("-l").arg("JavaScript")
        .arg("-e").arg(&script)
        .output()
        .ok()?;

    if output.status.success() {
        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if result == "SAME" {
            return Some((last_count, "SAME".to_string()));
        }
        // Parse "count|TYPE" or "count|IMAGE:/path"
        if let Some(idx) = result.find('|') {
            let count_str = &result[..idx];
            let payload = &result[idx + 1..];
            if let Ok(count) = count_str.parse::<i64>() {
                return Some((count, payload.to_string()));
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn poll_clipboard(_last_count: i64, _save_dir: &str) -> Option<(i64, String)> {
    // Windows fallback: always report TEXT
    Some((0, "TEXT".to_string()))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn poll_clipboard(_last_count: i64, _save_dir: &str) -> Option<(i64, String)> {
    None
}

/// Get the macOS screenshot save directory
#[cfg(target_os = "macos")]
fn get_screenshot_dir() -> PathBuf {
    use std::process::Command;
    let output = Command::new("defaults")
        .args(["read", "com.apple.screencapture", "location"])
        .output()
        .ok();
    if let Some(out) = output {
        if out.status.success() {
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let expanded = if path.starts_with('~') {
                dirs::home_dir()
                    .map(|h| h.join(&path[2..]))
                    .unwrap_or_else(|| PathBuf::from(&path))
            } else {
                PathBuf::from(&path)
            };
            if expanded.exists() {
                return expanded;
            }
        }
    }
    // Default: ~/Desktop
    dirs::desktop_dir().or_else(|| dirs::home_dir().map(|h| h.join("Desktop"))).unwrap_or_else(|| PathBuf::from("."))
}

/// Starts a thread that watches for new screenshot files on disk
fn start_screenshot_watcher(db: Arc<Database>) {
    std::thread::spawn(move || {
        #[cfg(target_os = "macos")]
        {
            let screenshot_dir = get_screenshot_dir();
            let mut known_files: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();

            // Seed with existing screenshots so we don't import old ones
            if let Ok(entries) = std::fs::read_dir(&screenshot_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n.starts_with("Screenshot") && n.ends_with(".png"))
                        .unwrap_or(false)
                    {
                        known_files.insert(path);
                    }
                }
            }

            loop {
                std::thread::sleep(Duration::from_millis(1500));

                let entries = match std::fs::read_dir(&screenshot_dir) {
                    Ok(e) => e,
                    Err(_) => continue,
                };

                for entry in entries.flatten() {
                    let path = entry.path();
                    let filename = match path.file_name().and_then(|n| n.to_str()) {
                        Some(n) => n.to_string(),
                        None => continue,
                    };

                    // Only process screenshot files
                    if !filename.starts_with("Screenshot") || !filename.ends_with(".png") {
                        continue;
                    }

                    if known_files.contains(&path) {
                        continue;
                    }

                    // Wait a moment for the file to finish writing
                    std::thread::sleep(Duration::from_millis(500));

                    let bytes = match std::fs::read(&path) {
                        Ok(b) => b,
                        Err(_) => continue,
                    };

                    let hash = hash_content(&bytes);
                    let file_size = bytes.len() as i64;

                    // Copy to our images directory
                    let dest_dir = match images_dir() {
                        Some(d) => d,
                        None => continue,
                    };
                    let dest = dest_dir.join(&filename);
                    if std::fs::copy(&path, &dest).is_err() {
                        continue;
                    }

                    let dest_str = dest.to_string_lossy().to_string();

                    let _ = db.insert_clip(
                        "image",
                        None,
                        Some(&dest_str),
                        Some("Screenshot"),
                        &hash,
                        &filename,
                        file_size,
                        false,
                    );

                    known_files.insert(path);
                }
            }
        }
    });
}

/// Starts the clipboard monitoring loop
pub fn start_monitor(db: Arc<Database>) {
    // Start the screenshot file watcher
    start_screenshot_watcher(Arc::clone(&db));

    std::thread::spawn(move || {
        let mut last_count: i64 = 0;
        let mut last_text_hash = String::new();
        let save_dir = images_dir()
            .map(|d| d.to_string_lossy().to_string())
            .unwrap_or_default();

        loop {
            std::thread::sleep(Duration::from_millis(800));

            let (new_count, payload) = match poll_clipboard(last_count, &save_dir) {
                Some(r) => r,
                None => continue,
            };
            last_count = new_count;

            if payload == "SAME" || payload == "EMPTY" {
                continue;
            }

            if let Some(path) = payload.strip_prefix("IMAGE:") {
                // Image was saved by JXA
                let filepath = PathBuf::from(path);
                let file_size = std::fs::metadata(&filepath).map(|m| m.len()).unwrap_or(0);
                let bytes = match std::fs::read(&filepath) {
                    Ok(b) => b,
                    Err(_) => continue,
                };
                let hash = hash_content(&bytes);
                let source_app = get_frontmost_app();

                let _ = db.insert_clip(
                    "image",
                    None,
                    Some(path),
                    source_app.as_deref(),
                    &hash,
                    "Screenshot",
                    file_size as i64,
                    false,
                );
            } else if payload == "TEXT" {
                // Handle text clipboard
                if let Some(text) = read_clipboard_text() {
                    if text.is_empty() {
                        continue;
                    }

                    let hash = hash_content(text.as_bytes());
                    if hash == last_text_hash {
                        continue;
                    }
                    last_text_hash = hash.clone();

                    let content_type = detect_content_type(&text);
                    let preview = make_preview(&text, 100);
                    let sensitive = is_sensitive_content(&text);
                    let source_app = get_frontmost_app();
                    let byte_size = text.len() as i64;

                    let _ = db.insert_clip(
                        content_type,
                        Some(&text),
                        None,
                        source_app.as_deref(),
                        &hash,
                        &preview,
                        byte_size,
                        sensitive,
                    );
                }
            }
        }
    });
}

#[cfg(target_os = "macos")]
fn read_clipboard_text() -> Option<String> {
    use std::process::Command;
    let output = Command::new("pbpaste")
        .output()
        .ok()?;
    if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout).to_string();
        if !text.is_empty() {
            return Some(text);
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn read_clipboard_text() -> Option<String> {
    use std::process::Command;
    let output = Command::new("powershell")
        .args(["-command", "Get-Clipboard"])
        .output()
        .ok()?;
    if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !text.is_empty() {
            return Some(text);
        }
    }
    None
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn read_clipboard_text() -> Option<String> {
    None
}
