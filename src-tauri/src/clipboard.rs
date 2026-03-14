use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::Emitter;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Global flag: is clipboard monitoring active?
static MONITORING: AtomicBool = AtomicBool::new(false);

/// Temporary pause flag (during selection translate, OCR, etc.)
static PAUSED: AtomicBool = AtomicBool::new(false);

/// Text to skip on next clipboard poll (set by frontend before auto-copy)
static SKIP_TEXT: Mutex<String> = Mutex::new(String::new());

/// Start the clipboard polling loop.
/// If already running, this is a no-op (the flag is simply set to true).
#[tauri::command]
pub fn start_clipboard_monitor(app: tauri::AppHandle) {
    if MONITORING.swap(true, Ordering::SeqCst) {
        return;
    }

    println!("[clipboard] Starting clipboard monitor...");

    std::thread::spawn(move || {
        // Initialize with current clipboard content to avoid triggering on start
        let mut previous_text = app
            .clipboard()
            .read_text()
            .unwrap_or_default();

        println!("[clipboard] Initialized with current clipboard ({} chars)", previous_text.len());

        loop {
            if !MONITORING.load(Ordering::SeqCst) {
                println!("[clipboard] Monitor stopped.");
                break;
            }

            // Skip polling while paused (selection translate, OCR, etc.)
            if PAUSED.load(Ordering::SeqCst) {
                std::thread::sleep(std::time::Duration::from_millis(500));
                // Update previous_text after resume to avoid stale trigger
                if let Ok(content) = app.clipboard().read_text() {
                    previous_text = content.trim().to_string();
                }
                continue;
            }

            match app.clipboard().read_text() {
                Ok(content) => {
                    let text = content.trim().to_string();
                    if !text.is_empty() && text != previous_text {
                        // Check if this text should be skipped (auto-copied translation)
                        let should_skip = {
                            let mut skip = SKIP_TEXT.lock().unwrap();
                            if !skip.is_empty() && text == *skip {
                                *skip = String::new();
                                true
                            } else {
                                false
                            }
                        };

                        previous_text = text.clone();

                        if !should_skip {
                            println!("[clipboard] New text ({} chars), emitting...", text.len());
                            let _ = app.emit("clipboard-text", text);
                        } else {
                            println!("[clipboard] Skipped auto-copied text");
                        }
                    }
                }
                Err(e) => {
                    // Clipboard may contain non-text data (images, etc.) — this is normal, don't spam logs
                    let msg = format!("{:?}", e);
                    if !msg.contains("not available") && !msg.contains("empty") {
                        eprintln!("[clipboard] read_text error: {:?}", e);
                    }
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });
}

/// Stop clipboard monitoring.
#[tauri::command]
pub fn stop_clipboard_monitor() {
    println!("[clipboard] Stopping clipboard monitor...");
    MONITORING.store(false, Ordering::SeqCst);
}

/// Tell the clipboard monitor to skip the next occurrence of this text.
/// Call this BEFORE writing to clipboard (auto-copy) to prevent re-triggering.
#[tauri::command]
pub fn clipboard_skip_next(text: String) {
    if let Ok(mut skip) = SKIP_TEXT.lock() {
        *skip = text;
    }
}

/// Temporarily pause clipboard monitoring (e.g., during selection translate).
pub fn pause() {
    PAUSED.store(true, Ordering::SeqCst);
}

/// Resume clipboard monitoring after a pause.
pub fn resume() {
    PAUSED.store(false, Ordering::SeqCst);
}
