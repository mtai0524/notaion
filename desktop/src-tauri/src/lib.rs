use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_window_state::StateFlags;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Ctrl+Alt+N from anywhere: bring the window up focused on quick capture.
    let capture = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN);

    tauri::Builder::default()
        // Must be first: a second launch (or a notaion:// link) focuses the
        // running instance instead of opening another window.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| show_main(app)))
        .plugin(tauri_plugin_deep_link::init())
        // Remember size/position, but never "hidden": the window is often
        // parked in the tray when the app exits, and must still open next launch.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &capture && event.state() == ShortcutState::Pressed {
                        show_main(app);
                        let _ = app.emit("quick-capture", ());
                    }
                })
                .build(),
        )
        .setup(move |app| {
            // Another app may own the combo; the app still works without it.
            if let Err(e) = app.global_shortcut().register(capture) {
                eprintln!("global shortcut Ctrl+Alt+N unavailable: {e}");
            }

            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                // Dev builds are not installed, so register notaion:// at runtime.
                let _ = app.deep_link().register_all();
            }

            let open = MenuItem::with_id(app, "open", "Mở Notaion Daily", true, None::<&str>)?;
            let capture_item =
                MenuItem::with_id(app, "capture", "Ghi nhanh  (Ctrl+Alt+N)", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Thoát", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &capture_item, &quit])?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Notaion Daily")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "capture" => {
                        show_main(app);
                        let _ = app.emit("quick-capture", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        // Closing the window keeps the app in the tray so the next open is instant.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Notaion Daily");
}
