use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::Emitter;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Global flag: is clipboard monitoring active?
static MONITORING: AtomicBool = AtomicBool::new(false);

/// Generation counter: incremented every time start_clipboard_monitor is called.
/// Each polling thread checks if its generation still matches to detect stale threads.
static GENERATION: AtomicU64 = AtomicU64::new(0);

/// Pause reference counter (supports nested pause/resume from concurrent handlers).
/// Paused when > 0, active when == 0.
static PAUSE_COUNT: AtomicU32 = AtomicU32::new(0);

/// Text to skip on next clipboard poll (set by frontend before auto-copy)
static SKIP_TEXT: Mutex<String> = Mutex::new(String::new());

/// Adaptive poll interval: faster after a change, slower when idle (saves CPU).
const INTERVAL_ACTIVE_MS: u64 = 350;
const INTERVAL_IDLE_MS: u64 = 900;
const IDLE_AFTER_UNCHANGED: u32 = 8;

/// Cheap clipboard revision token (skip `read_text` when unchanged).
/// - macOS: NSPasteboard.changeCount
/// - Windows: GetClipboardSequenceNumber (Win32)
/// - Linux: None → adaptive full-text poll (Wayland has no global change broadcast)
#[cfg(target_os = "macos")]
fn clipboard_revision() -> Option<i64> {
    use objc2_app_kit::NSPasteboard;
    let pb = NSPasteboard::generalPasteboard();
    Some(pb.changeCount() as i64)
}

#[cfg(target_os = "windows")]
fn clipboard_revision() -> Option<i64> {
    // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclipboardsequencenumber
    #[link(name = "user32")]
    extern "system" {
        fn GetClipboardSequenceNumber() -> u32;
    }
    unsafe { Some(GetClipboardSequenceNumber() as i64) }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn clipboard_revision() -> Option<i64> {
    None
}

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
        let mut unchanged_ticks: u32 = 0;
        let mut last_revision = clipboard_revision();
        let use_revision = last_revision.is_some();

        let mode = if !use_revision {
            "off-poll-text"
        } else if cfg!(target_os = "macos") {
            "macos-changeCount"
        } else if cfg!(target_os = "windows") {
            "win-sequenceNumber"
        } else {
            "revision"
        };
        println!(
            "[clipboard] Initialized ({} chars), revision_watch={}",
            previous_text.len(),
            mode
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
            if PAUSE_COUNT.load(Ordering::SeqCst) > 0 {
                std::thread::sleep(std::time::Duration::from_millis(INTERVAL_IDLE_MS));
                // Update previous_text after resume to avoid stale trigger
                if let Ok(content) = app.clipboard().read_text() {
                    previous_text = content.trim().to_string();
                }
                last_revision = clipboard_revision();
                unchanged_ticks = 0;
                continue;
            }

            // macOS/Windows: skip expensive read_text when revision token unchanged
            if use_revision {
                if let Some(rev) = clipboard_revision() {
                    if Some(rev) == last_revision {
                        unchanged_ticks = unchanged_ticks.saturating_add(1);
                        let interval = if unchanged_ticks >= IDLE_AFTER_UNCHANGED {
                            INTERVAL_IDLE_MS
                        } else {
                            INTERVAL_ACTIVE_MS
                        };
                        std::thread::sleep(std::time::Duration::from_millis(interval));
                        continue;
                    }
                    last_revision = Some(rev);
                }
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
                        unchanged_ticks = 0;

                        if !should_skip {
                            println!("[clipboard] New text ({} chars), emitting...", text.len());
                            let _ = app.emit("clipboard-text", text);
                        } else {
                            println!("[clipboard] Skipped auto-copied text");
                        }
                    } else {
                        unchanged_ticks = unchanged_ticks.saturating_add(1);
                    }
                }
                Err(e) => {
                    // Clipboard may contain non-text data (images, etc.) — this is normal, don't spam logs
                    let msg = format!("{:?}", e);
                    if !msg.contains("not available") && !msg.contains("empty") {
                        eprintln!("[clipboard] read_text error: {:?}", e);
                    }
                    unchanged_ticks = unchanged_ticks.saturating_add(1);
                }
            }

            let interval = if unchanged_ticks >= IDLE_AFTER_UNCHANGED {
                INTERVAL_IDLE_MS
            } else {
                INTERVAL_ACTIVE_MS
            };
            std::thread::sleep(std::time::Duration::from_millis(interval));
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

/// Temporarily pause clipboard monitoring (supports nested calls via reference counting).
#[tauri::command]
pub fn pause_clipboard_monitor_temp() {
    PAUSE_COUNT.fetch_add(1, Ordering::SeqCst);
}

/// Resume clipboard monitoring after a pause (decrements ref count; resumes when count reaches 0).
#[tauri::command]
pub fn resume_clipboard_monitor_temp() {
    PAUSE_COUNT
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |current| {
            Some(current.saturating_sub(1))
        })
        .ok();
}
