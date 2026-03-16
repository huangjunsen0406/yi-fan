use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::Emitter;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Global flag: is clipboard monitoring active?
static MONITORING: AtomicBool = AtomicBool::new(false);

/// Generation counter: incremented every time start_clipboard_monitor is called.
/// Each polling thread checks if its generation still matches to detect stale threads.
static GENERATION: AtomicU64 = AtomicU64::new(0);

/// Temporary pause flag (during selection translate, OCR, etc.)
static PAUSED: AtomicBool = AtomicBool::new(false);

/// Text to skip on next clipboard poll (set by frontend before auto-copy)
static SKIP_TEXT: Mutex<String> = Mutex::new(String::new());

/// Start the clipboard polling loop.
/// Each call increments the generation counter, causing any previous thread to exit.
#[tauri::command]
pub fn start_clipboard_monitor(app: tauri::AppHandle) {
    // Increment generation to invalidate any existing polling thread
    let gen = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    MONITORING.store(true, Ordering::SeqCst);

    println!("[clipboard] Starting clipboard monitor (gen={})...", gen);

    std::thread::spawn(move || {
        // Initialize with current clipboard content to avoid triggering on start
        let mut previous_text = app.clipboard().read_text().unwrap_or_default();

        println!(
            "[clipboard] Initialized with current clipboard ({} chars)",
            previous_text.len()
        );

        loop {
            // Check if monitoring was stopped
            if !MONITORING.load(Ordering::SeqCst) {
                println!("[clipboard] Monitor stopped (gen={}).", gen);
                break;
            }

            // Check if a newer generation has started — this thread is stale
            if GENERATION.load(Ordering::SeqCst) != gen {
                println!("[clipboard] Monitor gen={} superseded, exiting.", gen);
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

/// Toggle clipboard monitoring on/off. Emits "clipboard-monitor-toggled" with the new state.
#[tauri::command]
pub fn toggle_clipboard_monitor(app: tauri::AppHandle) {
    if MONITORING.load(Ordering::SeqCst) {
        println!("[clipboard] Toggle: stopping monitor");
        MONITORING.store(false, Ordering::SeqCst);
        let _ = app.emit("clipboard-monitor-toggled", false);
    } else {
        println!("[clipboard] Toggle: starting monitor");
        start_clipboard_monitor(app.clone());
        let _ = app.emit("clipboard-monitor-toggled", true);
    }
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
#[tauri::command]
pub fn pause_clipboard_monitor_temp() {
    PAUSED.store(true, Ordering::SeqCst);
}

/// Resume clipboard monitoring after a pause.
#[tauri::command]
pub fn resume_clipboard_monitor_temp() {
    PAUSED.store(false, Ordering::SeqCst);
}
