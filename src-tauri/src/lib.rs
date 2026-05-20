use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent, Wry,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::StateFlags;

struct TrayPreferences {
    close_to_tray: AtomicBool,
    menu_items: Mutex<Option<TrayMenuItems>>,
}

struct TrayMenuItems {
    status: MenuItem<Wry>,
    session: MenuItem<Wry>,
    toggle: MenuItem<Wry>,
}

#[tauri::command]
fn set_close_to_tray(enabled: bool, state: State<'_, TrayPreferences>) {
    state.close_to_tray.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    show_window(&app)
}

#[tauri::command]
fn is_autostart_launch() -> bool {
    std::env::args().any(|arg| arg == "--autostart")
}

#[tauri::command]
fn update_tray_status(
    app: AppHandle,
    status: String,
    session: String,
    toggle_label: String,
) -> Result<(), String> {
    if let Some(state) = app.try_state::<TrayPreferences>() {
        if let Some(items) = state.menu_items.lock().map_err(|err| err.to_string())?.as_ref() {
            items.status.set_text(status).map_err(|err| err.to_string())?;
            items.session.set_text(session).map_err(|err| err.to_string())?;
            items.toggle.set_text(toggle_label).map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}

fn show_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    window.show().map_err(|err| err.to_string())?;
    window.unminimize().map_err(|err| err.to_string())?;
    window.set_focus().map_err(|err| err.to_string())?;
    Ok(())
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let status = MenuItem::with_id(app, "status", "Status: Ausgestempelt", false, None::<&str>)?;
    let session = MenuItem::with_id(app, "session", "Aktuelle Session: -", false, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "App öffnen", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle_punch", "Einstempeln", true, None::<&str>)?;
    let today = MenuItem::with_id(app, "today", "Heute anzeigen", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&status, &session, &open, &toggle, &today, &quit])?;

    let mut builder = TrayIconBuilder::with_id("timeglass-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = show_window(&tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;

    if let Some(state) = app.try_state::<TrayPreferences>() {
        *state.menu_items.lock().expect("tray menu state poisoned") = Some(TrayMenuItems {
            status,
            session,
            toggle,
        });
    }

    app.on_menu_event(|app, event| match event.id().as_ref() {
        "open" => {
            let _ = show_window(app);
        }
        "today" => {
            let _ = show_window(app);
            let _ = app.emit("tray://today", ());
        }
        "toggle_punch" => {
            let _ = app.emit("tray://toggle-punch", ());
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    });

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(TrayPreferences {
            close_to_tray: AtomicBool::new(false),
            menu_items: Mutex::new(None),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(StateFlags::all()).build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            set_close_to_tray,
            show_main_window,
            is_autostart_launch,
            update_tray_status
        ])
        .setup(|app| {
            build_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                if let Some(state) = app.try_state::<TrayPreferences>() {
                    if state.close_to_tray.load(Ordering::Relaxed) {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running TimeGlass");
}
