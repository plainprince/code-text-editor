use std::process::{Command, Stdio, Child};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::io::{Read, Write, BufReader, BufRead};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageServerProcess {
    pub id: String,
    pub command: String,
    pub args: Vec<String>,
    pub language: String,
}

pub type LanguageServerMap = Arc<Mutex<HashMap<String, Child>>>;

#[tauri::command]
pub fn check_command_exists(command: String) -> Result<bool, String> {
    let result = if cfg!(target_os = "windows") {
        Command::new("where")
            .arg(&command)
            .output()
    } else {
        Command::new("which")
            .arg(&command)
            .output()
    };

    match result {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub fn start_language_server(
    command: String,
    args: Vec<String>,
    language: String,
    app_handle: AppHandle,
    language_servers: tauri::State<LanguageServerMap>,
) -> Result<String, String> {
    let process_id = format!("{}_{}", language, chrono::Utc::now().timestamp_millis());
    
    let mut cmd = Command::new(&command);
    cmd.args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    match cmd.spawn() {
        Ok(mut child) => {
            let stdout = child.stdout.take().ok_or("Failed to take stdout")?;
            let stderr = child.stderr.take().ok_or("Failed to take stderr")?;
            
            let listener_app_handle = app_handle.clone();
            let listener_process_id = process_id.clone();
            
            // Spawn stdout listener thread
            std::thread::spawn(move || {
                let mut reader = BufReader::new(stdout);
                loop {
                    // Read one line and emit as raw
                    let mut buffer = String::new();
                    match reader.read_line(&mut buffer) {
                        Ok(0) => {
                            let _ = listener_app_handle.emit("lsp_log_line", "[stdout-line] <eof>");
                            break;
                        }
                        Ok(_) => {
                            let line = buffer.clone();
                            if !line.trim().is_empty() {
                                let _ = listener_app_handle.emit("lsp_log_line", format!("[stdout-line] {}", line.trim_end()));
                            }
                            // Best-effort: if this line is a header start, fall back to Content-Length parsing
                            if line.to_ascii_lowercase().starts_with("content-length:") {
                                let mut headers = HashMap::new();
                                if let Some((_, v)) = line.trim().split_once(":") { 
                                    headers.insert("Content-Length".to_string(), v.trim().to_string()); 
                                }
                                // read CRLF
                                let mut crlf = String::new();
                                let _ = reader.read_line(&mut crlf);
                                if let Some(length_str) = headers.get("Content-Length") {
                                    if let Ok(length) = length_str.parse::<usize>() {
                                        let mut body_buffer = vec![0; length];
                                        if reader.read_exact(&mut body_buffer).is_ok() {
                                            if let Ok(json_body) = String::from_utf8(body_buffer) {
                                                let _ = listener_app_handle.emit("lsp_log_line", format!("[stdout-raw-body] {}", json_body));
                                                let _ = listener_app_handle.emit("lsp_message", json_body);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }
            });

            // Spawn stderr listener thread
            let stderr_app_handle = app_handle.clone();
            std::thread::spawn(move || {
                let mut reader = BufReader::new(stderr);
                let mut buffer = String::new();
                while reader.read_line(&mut buffer).unwrap_or(0) > 0 {
                    let _ = stderr_app_handle.emit("lsp_log_line", format!("[stderr] {}", buffer.trim()));
                    buffer.clear();
                }
            });

            // Store the child process
            language_servers.lock().unwrap().insert(process_id.clone(), child);
            Ok(process_id)
        }
        Err(e) => Err(format!("Failed to start language server: {}", e)),
    }
}

#[tauri::command]
pub fn send_lsp_request(
    process_id: String,
    message: String,
    language_servers: tauri::State<LanguageServerMap>,
) -> Result<String, String> {
    let mut servers = language_servers.lock().unwrap();
    
    if let Some(child) = servers.get_mut(&process_id) {
        if let Some(stdin) = child.stdin.as_mut() {
            let content_length = message.len();
            let request = format!("Content-Length: {}\r\n\r\n{}", content_length, message);
            
            stdin.write_all(request.as_bytes())
                .map_err(|e| format!("Failed to write to language server: {}", e))?;
            stdin.flush()
                .map_err(|e| format!("Failed to flush language server input: {}", e))?;
            
            Ok("Request sent".to_string())
        } else {
            Err("Language server stdin not available".to_string())
        }
    } else {
        Err("Language server not found".to_string())
    }
}

#[tauri::command]
pub fn send_lsp_notification(
    process_id: String,
    message: String,
    language_servers: tauri::State<LanguageServerMap>,
) -> Result<String, String> {
    let mut servers = language_servers.lock().unwrap();
    
    if let Some(child) = servers.get_mut(&process_id) {
        if let Some(stdin) = child.stdin.as_mut() {
            let content_length = message.len();
            let notification = format!("Content-Length: {}\r\n\r\n{}", content_length, message);
            
            stdin.write_all(notification.as_bytes())
                .map_err(|e| format!("Failed to write notification to language server: {}", e))?;
            stdin.flush()
                .map_err(|e| format!("Failed to flush language server input: {}", e))?;
            
            Ok("Notification sent".to_string())
        } else {
            Err("Language server stdin not available".to_string())
        }
    } else {
        Err("Language server not found".to_string())
    }
}

#[tauri::command]
pub fn shutdown_all_language_servers(language_servers: tauri::State<LanguageServerMap>) -> Result<String, String> {
    let mut servers = language_servers.lock().unwrap();
    let mut killed_count = 0;
    
    for (id, mut child) in servers.drain() {
        match child.kill() {
            Ok(_) => {
                let _ = child.wait();
                killed_count += 1;
            }
            Err(e) => eprintln!("Failed to kill language server {}: {}", id, e),
        }
    }
    
    Ok(format!("Shut down {} language servers", killed_count))
}
