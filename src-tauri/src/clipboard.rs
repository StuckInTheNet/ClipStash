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

fn make_preview(text: &str, max_len: usize) -> String {
    let single_line = text.lines().next().unwrap_or("").trim();
    if single_line.len() > max_len {
        format!("{}...", &single_line[..max_len])
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

/// Check what type of content is on the clipboard (macOS)
#[cfg(target_os = "macos")]
fn clipboard_content_type() -> Option<&'static str> {
    use std::process::Command;
    // Check clipboard types using AppleScript
    let output = Command::new("osascript")
        .arg("-e")
        .arg("clipboard info")
        .output()
        .ok()?;
    if output.status.success() {
        let info = String::from_utf8_lossy(&output.stdout);
        let has_image = info.contains("TIFF") || info.contains("PNGf") || info.contains("tiff") || info.contains("png");
        let has_text = info.contains("«class utf8»") || info.contains("«class ut16»") || info.contains("string");

        // Prioritize image — screenshots may include text metadata
        if has_image {
            return Some("image");
        }
        if has_text {
            return Some("text");
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn clipboard_content_type() -> Option<&'static str> {
    // Windows: default to text for now, image support requires win32 API
    Some("text")
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn clipboard_content_type() -> Option<&'static str> {
    Some("text")
}

/// Save clipboard image to disk (macOS)
#[cfg(target_os = "macos")]
fn save_clipboard_image() -> Option<(PathBuf, u64)> {
    use std::process::Command;

    let dir = images_dir()?;
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S_%3f");
    let filename = format!("clip_{}.png", timestamp);
    let filepath = dir.join(&filename);

    // Use osascript to save clipboard image as PNG via a temp TIFF
    // pngpaste is more reliable if available, but osascript works as fallback
    let script = format!(
        r#"
        use framework "AppKit"
        set pb to current application's NSPasteboard's generalPasteboard()
        set imgData to pb's dataForType:(current application's NSPasteboardTypeTIFF)
        if imgData is missing value then return "no_image"
        set bitmapRep to current application's NSBitmapImageRep's imageRepWithData:imgData
        set pngData to bitmapRep's representationUsingType:(current application's NSBitmapImageFileTypePNG) properties:(missing value)
        pngData's writeToFile:"{}" atomically:true
        return "ok"
        "#,
        filepath.display()
    );

    let output = Command::new("osascript")
        .arg("-l")
        .arg("AppleScript")
        .arg("-e")
        .arg(&script)
        .output()
        .ok()?;

    if output.status.success() {
        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if result == "ok" {
            let metadata = std::fs::metadata(&filepath).ok()?;
            return Some((filepath, metadata.len()));
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn save_clipboard_image() -> Option<(PathBuf, u64)> {
    None
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn save_clipboard_image() -> Option<(PathBuf, u64)> {
    None
}

/// Starts the clipboard monitoring loop
pub fn start_monitor(db: Arc<Database>) {
    std::thread::spawn(move || {
        let mut last_hash = String::new();

        loop {
            std::thread::sleep(Duration::from_millis(500));

            let content_kind = match clipboard_content_type() {
                Some(k) => k,
                None => continue,
            };

            if content_kind == "image" {
                // Handle image clipboard (screenshots, copied images)
                if let Some((filepath, file_size)) = save_clipboard_image() {
                    // Read file bytes for hashing
                    let bytes = match std::fs::read(&filepath) {
                        Ok(b) => b,
                        Err(_) => continue,
                    };
                    let hash = hash_content(&bytes);
                    if hash == last_hash {
                        // Duplicate image, remove the file we just saved
                        let _ = std::fs::remove_file(&filepath);
                        continue;
                    }
                    last_hash = hash.clone();

                    let source_app = get_frontmost_app();
                    let path_str = filepath.to_string_lossy().to_string();

                    let _ = db.insert_clip(
                        "image",
                        None,
                        Some(&path_str),
                        source_app.as_deref(),
                        &hash,
                        "Screenshot",
                        file_size as i64,
                        false,
                    );
                }
            } else {
                // Handle text clipboard
                if let Some(text) = read_clipboard_text() {
                    if text.is_empty() {
                        continue;
                    }

                    let hash = hash_content(text.as_bytes());
                    if hash == last_hash {
                        continue;
                    }
                    last_hash = hash.clone();

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
