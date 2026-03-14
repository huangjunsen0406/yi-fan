use tauri::Emitter;
use tauri::Manager;

mod clipboard;
mod lang_detect;
mod screenshot;
mod tray;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Toggle main window visibility: show+focus if hidden, hide if visible
#[tauri::command]
fn toggle_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

/// Helper: show window and set focus
fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Helper: hide window
fn hide_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

/// Selection translate: get selected text → show window → emit text
pub(crate) fn do_selection_translate(app: tauri::AppHandle) {
    // Pause clipboard monitor so Cmd+C doesn't trigger it
    clipboard::pause();

    // get_selected_text() simulates Cmd+C → reads clipboard
    // Must run while the OTHER app still has focus
    match screenshot::get_selected_text() {
        Ok(text) => {
            show_main(&app);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("selection-text", text);
            }
        }
        Err(e) => {
            eprintln!("get_selected_text failed: {}", e);
            show_main(&app);
        }
    }

    // Resume clipboard monitor after a short delay
    std::thread::sleep(std::time::Duration::from_millis(300));
    clipboard::resume();
}

/// OCR recognize: hide window → screencapture → show window → emit navigate
pub(crate) fn do_ocr_recognize(app: tauri::AppHandle) {
    hide_main(&app);
    // Small delay to let the window fully hide
    std::thread::sleep(std::time::Duration::from_millis(200));

    match screenshot::screencapture_select() {
        Ok(true) => {
            show_main(&app);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("ocr-recognize-done", "");
            }
        }
        _ => {
            // User cancelled or error — show window back
            show_main(&app);
        }
    }
}

/// OCR translate: hide → screencapture → OCR → show → emit text
pub(crate) fn do_ocr_translate(app: tauri::AppHandle) {
    hide_main(&app);
    std::thread::sleep(std::time::Duration::from_millis(200));

    match screenshot::screencapture_select() {
        Ok(true) => {
            // Run OCR
            match screenshot::system_ocr("auto".to_string()) {
                Ok(text) => {
                    show_main(&app);
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("ocr-translate-done", text);
                    }
                }
                Err(e) => {
                    eprintln!("OCR failed: {}", e);
                    show_main(&app);
                }
            }
        }
        _ => {
            show_main(&app);
        }
    }
}

// Tauri commands (for invoke from frontend)
#[tauri::command]
fn selection_translate(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        do_selection_translate(app);
    });
}

#[tauri::command]
fn ocr_recognize(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        do_ocr_recognize(app);
    });
}

#[tauri::command]
fn ocr_translate(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        do_ocr_translate(app);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            // System tray
            tray::create_tray(app)?;

            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
                };

                let shortcut_toggle = Shortcut::new(Some(Modifiers::ALT), Code::Space);
                let shortcut_selection = Shortcut::new(Some(Modifiers::ALT), Code::KeyD);
                let shortcut_ocr_recognize = Shortcut::new(Some(Modifiers::ALT), Code::KeyS);
                let shortcut_ocr_translate =
                    Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::KeyS);

                let s_toggle = shortcut_toggle;
                let s_selection = shortcut_selection;
                let s_ocr_rec = shortcut_ocr_recognize;
                let s_ocr_trans = shortcut_ocr_translate;

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                if shortcut == &s_toggle {
                                    if let Some(window) = app.get_webview_window("main") {
                                        if window.is_visible().unwrap_or(false) {
                                            let _ = window.hide();
                                        } else {
                                            let _ = window.show();
                                            let _ = window.set_focus();
                                        }
                                    }
                                } else if shortcut == &s_selection {
                                    // All blocking work in a thread
                                    let app = app.clone();
                                    std::thread::spawn(move || {
                                        do_selection_translate(app);
                                    });
                                } else if shortcut == &s_ocr_rec {
                                    let app = app.clone();
                                    std::thread::spawn(move || {
                                        do_ocr_recognize(app);
                                    });
                                } else if shortcut == &s_ocr_trans {
                                    let app = app.clone();
                                    std::thread::spawn(move || {
                                        do_ocr_translate(app);
                                    });
                                }
                            }
                        })
                        .build(),
                )?;

                let gs = app.global_shortcut();
                gs.register(shortcut_toggle)?;
                gs.register(shortcut_selection)?;
                gs.register(shortcut_ocr_recognize)?;
                gs.register(shortcut_ocr_translate)?;

                println!("Registered global shortcuts: Alt+Space, Alt+D, Alt+S, Alt+Shift+S");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            toggle_window,
            selection_translate,
            ocr_recognize,
            ocr_translate,
            screenshot::screenshot,
            screenshot::cut_image,
            screenshot::get_base64,
            screenshot::system_ocr,
            screenshot::screencapture_select,
            screenshot::get_selected_text,
            clipboard::start_clipboard_monitor,
            clipboard::stop_clipboard_monitor,
            clipboard::clipboard_skip_next,
            lang_detect::detect_language,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
