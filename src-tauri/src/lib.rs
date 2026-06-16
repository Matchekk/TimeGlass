use std::path::PathBuf;
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
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_window_state::StateFlags;

struct TrayPreferences {
    close_to_tray: AtomicBool,
    tray_left_click_punch: AtomicBool,
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
fn set_tray_left_click(punch: bool, state: State<'_, TrayPreferences>) {
    state.tray_left_click_punch.store(punch, Ordering::Relaxed);
}

/// Inaktivitaet des Nutzers in Sekunden (Tastatur/Maus). Fuer die
/// Abwesenheits-Erkennung waehrend einer laufenden Session.
#[cfg(windows)]
#[tauri::command]
fn get_idle_seconds() -> u64 {
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    unsafe {
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut info).as_bool() {
            let now = GetTickCount();
            let idle_ms = now.wrapping_sub(info.dwTime);
            (idle_ms / 1000) as u64
        } else {
            0
        }
    }
}

#[cfg(not(windows))]
#[tauri::command]
fn get_idle_seconds() -> u64 {
    0
}

fn resolve_db_dir(app: &AppHandle) -> Option<PathBuf> {
    let candidates = [app.path().app_config_dir(), app.path().app_data_dir()];
    for dir in candidates.iter().flatten() {
        if dir.join("timeglass.db").exists() {
            return Some(dir.clone());
        }
    }
    app.path().app_config_dir().ok()
}

fn ensure_backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = resolve_db_dir(app).ok_or_else(|| "App-Verzeichnis nicht gefunden".to_string())?;
    let dir = base.join("backups");
    std::fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir)
}

fn prune_backups(dir: &std::path::Path, retention: usize) {
    let mut files: Vec<PathBuf> = match std::fs::read_dir(dir) {
        Ok(read) => read
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.starts_with("timeglass-") && name.ends_with(".db"))
                    .unwrap_or(false)
            })
            .collect(),
        Err(_) => return,
    };
    files.sort();
    if files.len() > retention {
        for path in &files[..files.len() - retention] {
            let _ = std::fs::remove_file(path);
        }
    }
}

/// Kopiert die SQLite-Datenbank in den backups-Ordner und behaelt nur die
/// neuesten `retention` Sicherungen. `label` ist ein bereits sortierbarer
/// Zeitstempel aus dem Frontend (z. B. 2026-06-16-0915).
#[tauri::command]
fn create_db_backup(app: AppHandle, retention: u32, label: String) -> Result<String, String> {
    let base = resolve_db_dir(&app).ok_or_else(|| "App-Verzeichnis nicht gefunden".to_string())?;
    let db_path = base.join("timeglass.db");
    if !db_path.exists() {
        return Err("Datenbank ist noch nicht vorhanden.".to_string());
    }
    let dir = base.join("backups");
    std::fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let safe_label: String = label
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let dest = dir.join(format!("timeglass-{}.db", safe_label));
    std::fs::copy(&db_path, &dest).map_err(|err| err.to_string())?;
    prune_backups(&dir, retention.max(1) as usize);
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn open_backup_dir(app: AppHandle) -> Result<(), String> {
    let dir = ensure_backups_dir(&app)?;
    app.opener()
        .open_path(dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|err| err.to_string())
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
        if let Some(items) = state
            .menu_items
            .lock()
            .map_err(|err| err.to_string())?
            .as_ref()
        {
            items
                .status
                .set_text(status)
                .map_err(|err| err.to_string())?;
            items
                .session
                .set_text(session)
                .map_err(|err| err.to_string())?;
            items
                .toggle
                .set_text(toggle_label)
                .map_err(|err| err.to_string())?;
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
                let app = tray.app_handle();
                let punch = app
                    .try_state::<TrayPreferences>()
                    .map(|state| state.tray_left_click_punch.load(Ordering::Relaxed))
                    .unwrap_or(false);
                if punch {
                    let _ = app.emit("tray://toggle-punch", ());
                } else {
                    let _ = show_window(app);
                }
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
    let mut builder = tauri::Builder::default();

    // Single-Instance MUSS als erstes Plugin registriert werden. Verhindert, dass
    // ein erneuter Start (z. B. Klick auf das Taskleisten-Icon) ein zweites Fenster
    // oeffnet – stattdessen wird das bestehende Fenster gezeigt und fokussiert.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = show_window(app);
        }));
        // Globaler Hotkey (wird vom Frontend registriert).
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .manage(TrayPreferences {
            close_to_tray: AtomicBool::new(false),
            tray_left_click_punch: AtomicBool::new(false),
            menu_items: Mutex::new(None),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all())
                .build(),
        )
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            set_close_to_tray,
            set_tray_left_click,
            show_main_window,
            is_autostart_launch,
            update_tray_status,
            get_idle_seconds,
            create_db_backup,
            open_backup_dir
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
