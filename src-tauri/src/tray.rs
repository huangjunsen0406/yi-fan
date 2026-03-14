use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

pub fn create_tray(app: &tauri::App) -> tauri::Result<()> {
    // ── Menu items ──
    let show_i = MenuItem::with_id(app, "show", "显示/隐藏", true, None::<&str>)?;
    let clipboard_i = MenuItem::with_id(app, "clipboard", "剪贴板监听", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let ocr_rec_i = MenuItem::with_id(app, "ocr_recognize", "截图识别", true, None::<&str>)?;
    let ocr_trans_i = MenuItem::with_id(app, "ocr_translate", "截图翻译", true, None::<&str>)?;
    let sel_trans_i =
        MenuItem::with_id(app, "selection_translate", "划词翻译", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let history_i = MenuItem::with_id(app, "history", "翻译历史", true, None::<&str>)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_i,
            &clipboard_i,
            &sep1,
            &sel_trans_i,
            &ocr_rec_i,
            &ocr_trans_i,
            &sep2,
            &history_i,
            &sep3,
            &quit_i,
        ],
    )?;

    // ── Build tray ──
    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("易翻")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id.as_ref();
            match id {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                "clipboard" => {
                    // Emit to frontend to toggle clipboard monitor
                    let _ = app.emit("tray-clipboard-toggle", "");
                }
                "selection_translate" => {
                    let app = app.clone();
                    std::thread::spawn(move || {
                        crate::do_selection_translate(app);
                    });
                }
                "ocr_recognize" => {
                    let app = app.clone();
                    std::thread::spawn(move || {
                        crate::do_ocr_recognize(app);
                    });
                }
                "ocr_translate" => {
                    let app = app.clone();
                    std::thread::spawn(move || {
                        crate::do_ocr_translate(app);
                    });
                }
                "history" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = app.emit("navigate", "/history");
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Left-click on tray icon → show/hide window
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
