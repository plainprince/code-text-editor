#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use std::path::Path;
use serde_json::Value;
use tauri::Manager;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use std::io::Read;

// File system commands
#[tauri::command]
fn read_text_file(file_path: String) -> Result<String, String> {
    match fs::read_to_string(&file_path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read file {}: {}", file_path, e))
    }
}

#[tauri::command]
fn write_text_file(file_path: String, content: String) -> Result<String, String> {
    // Create parent directories if they don't exist
    if let Some(parent) = Path::new(&file_path).parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return Err(format!("Failed to create directories: {}", e));
        }
    }
    
    match fs::write(&file_path, content) {
        Ok(_) => Ok("File written successfully".to_string()),
        Err(e) => Err(format!("Failed to write file {}: {}", file_path, e))
    }
}

#[tauri::command]
fn read_directory(dir_path: String) -> Result<Value, String> {
    let path = Path::new(&dir_path);
    
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }
    
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path));
    }
    
    let mut entries = Vec::new();
    
    match fs::read_dir(path) {
        Ok(dir_entries) => {
            for entry in dir_entries {
                match entry {
                    Ok(entry) => {
                        let path = entry.path();
                        let name = match path.file_name() {
                            Some(name) => name.to_string_lossy().to_string(),
                            None => continue,
                        };
                        
                        // Skip hidden files/directories
                        if name.starts_with('.') {
                            continue;
                        }
                        
                        let kind = if path.is_dir() { "folder" } else { "file" };
                        let path_str = path.to_string_lossy().to_string();
                        
                        entries.push(serde_json::json!({
                            "name": name,
                            "path": path_str,
                            "kind": kind
                        }));
                    },
                    Err(_) => continue,
                }
            }
        },
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }
    
    // Sort entries: folders first, then files, both alphabetically
    entries.sort_by(|a, b| {
        let a_kind = a["kind"].as_str().unwrap_or("");
        let b_kind = b["kind"].as_str().unwrap_or("");
        let a_name = a["name"].as_str().unwrap_or("");
        let b_name = b["name"].as_str().unwrap_or("");
        
        match (a_kind, b_kind) {
            ("folder", "file") => std::cmp::Ordering::Less,
            ("file", "folder") => std::cmp::Ordering::Greater,
            _ => a_name.cmp(b_name),
        }
    });
    
    Ok(serde_json::Value::Array(entries))
}

#[tauri::command]
fn file_exists(file_path: String) -> bool {
    Path::new(&file_path).exists()
}

#[tauri::command]
fn is_directory(path: String) -> bool {
    Path::new(&path).is_dir()
}

#[tauri::command]
fn get_settings_file_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    match app_handle.path().app_config_dir() {
        Ok(config_dir) => {
            let settings_file = config_dir.join("settings.json");
            Ok(settings_file.to_string_lossy().to_string())
        },
        Err(e) => Err(format!("Failed to get config directory: {}", e))
    }
}



#[tauri::command]
fn get_workspace_files(workspace_path: String) -> Result<Vec<Value>, String> {
    let mut files = Vec::new();
    
    fn scan_directory(dir: &Path, base_path: &Path, files: &mut Vec<Value>) -> Result<(), std::io::Error> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let relative_path = path.strip_prefix(base_path).unwrap_or(&path);
            
            // Skip hidden files and common ignore patterns
            let name = path.file_name().unwrap_or_default().to_string_lossy();
            if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
                continue;
            }
            
            if path.is_file() {
                files.push(serde_json::json!({
                    "path": path.to_string_lossy(),
                    "relativePath": relative_path.to_string_lossy(),
                    "name": name,
                    "isFile": true
                }));
            } else if path.is_dir() {
                scan_directory(&path, base_path, files)?;
            }
        }
        Ok(())
    }
    
    let workspace = Path::new(&workspace_path);
    if workspace.exists() && workspace.is_dir() {
        scan_directory(workspace, workspace, &mut files).map_err(|e| e.to_string())?;
    }
    
    // Sort files alphabetically
    files.sort_by(|a, b| {
        a["relativePath"].as_str().unwrap_or("").cmp(b["relativePath"].as_str().unwrap_or(""))
    });
    
    Ok(files)
}

// Terminal state management
type TerminalSessions = Arc<Mutex<HashMap<String, Arc<Mutex<portable_pty::PtyPair>>>>>;

#[tauri::command]
async fn create_terminal_session(
    session_id: String,
    app_handle: AppHandle,
    sessions: tauri::State<'_, TerminalSessions>,
) -> Result<String, String> {
    use portable_pty::{CommandBuilder, PtySize, PtySystem};
    
    let pty_system = portable_pty::native_pty_system();
    
    // Create a new pty
    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to create pty: {}", e))?;

    // Determine shell based on platform
    let shell = if cfg!(windows) {
        CommandBuilder::new("cmd.exe")
    } else {
        // Try to use user's shell from environment, fallback to sh
        let shell_path = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
        CommandBuilder::new(shell_path)
    };

    // Spawn the shell
    let child = pty_pair
        .slave
        .spawn_command(shell)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Store the session
    let pty_pair = Arc::new(Mutex::new(pty_pair));
    sessions.lock().unwrap().insert(session_id.clone(), pty_pair.clone());

    // Start reading from the pty and emit events
    let app_handle_clone = app_handle.clone();
    let session_id_clone = session_id.clone();
    let pty_pair_clone = pty_pair.clone();
    
    tokio::spawn(async move {
        let mut reader = {
            let pty_pair = pty_pair_clone.lock().unwrap();
            pty_pair.master.try_clone_reader().unwrap()
        };
        
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let output = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle_clone.emit(&format!("terminal-output-{}", session_id_clone), output);
                }
                Ok(_) => break, // EOF
                Err(_) => break, // Error
            }
        }
    });

    Ok(session_id)
}

#[tauri::command]
async fn write_to_terminal(
    session_id: String,
    data: String,
    sessions: tauri::State<'_, TerminalSessions>,
) -> Result<(), String> {
    use std::io::Write;
    
    let sessions = sessions.lock().unwrap();
    if let Some(pty_pair) = sessions.get(&session_id) {
        let pty_pair = pty_pair.lock().unwrap();
        let mut writer = pty_pair.master.take_writer().map_err(|e| format!("Failed to get writer: {}", e))?;
        writer.write_all(data.as_bytes()).map_err(|e| format!("Failed to write: {}", e))?;
        writer.flush().map_err(|e| format!("Failed to flush: {}", e))?;
        Ok(())
    } else {
        Err("Terminal session not found".to_string())
    }
}

#[tauri::command]
async fn close_terminal_session(
    session_id: String,
    sessions: tauri::State<'_, TerminalSessions>,
) -> Result<(), String> {
    let mut sessions = sessions.lock().unwrap();
    sessions.remove(&session_id);
    Ok(())
}

#[tauri::command]
async fn resize_terminal(
    session_id: String,
    rows: u16,
    cols: u16,
    sessions: tauri::State<'_, TerminalSessions>,
) -> Result<(), String> {
    use portable_pty::PtySize;
    
    let sessions = sessions.lock().unwrap();
    if let Some(pty_pair) = sessions.get(&session_id) {
        let pty_pair = pty_pair.lock().unwrap();
        pty_pair.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| format!("Failed to resize: {}", e))?;
        Ok(())
    } else {
        Err("Terminal session not found".to_string())
    }
}

fn main() {
    let terminal_sessions: TerminalSessions = Arc::new(Mutex::new(HashMap::new()));
    
    tauri::Builder::default()
        .manage(terminal_sessions)
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            read_directory,
            file_exists,
            is_directory,
            get_settings_file_path,
            get_workspace_files,
            create_terminal_session,
            write_to_terminal,
            close_terminal_session,
            resize_terminal
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
