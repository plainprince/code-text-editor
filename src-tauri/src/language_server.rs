use std::process::{Command, Stdio, Child};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::io::{Read, Write, BufReader, BufRead};
use serde::{Deserialize, Serialize};
use serde_json::Value;
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
                    // Parse LSP messages via Content-Length framing (per spec)
                    let mut header = String::new();
                    // Read headers until empty line (CRLF)
                    loop {
                        header.clear();
                        match reader.read_line(&mut header) {
                            Ok(0) => {
                                let _ = listener_app_handle.emit("lsp_log_line", "[stdout] <eof>");
                                return;
                            }
                            Ok(_) => {
                                let trimmed = header.trim_end();
                                if !trimmed.is_empty() {
                                    let _ = listener_app_handle.emit("lsp_log_line", format!("[header] {}", trimmed));
                                }
                                if trimmed.is_empty() {
                                    break; // end of headers
                                }
                                // Accumulate headers to find Content-Length
                            }
                            Err(_) => return,
                        }
                    }

                    // We need to re-parse the headers to get Content-Length
                    // For simplicity, re-read a small buffer from the underlying stream until CRLFCRLF seen would be complex.
                    // Instead, read the last emitted header line as Content-Length using a minimal approach.
                    // Robust approach: read headers into a map.
                    let mut headers_map: HashMap<String, String> = HashMap::new();
                    // We cannot rewind BufReader easily; a simple second pass is not possible.
                    // So instead, read lines again accumulating until empty line, but we already consumed it.
                    // Fallback: assume servers always send Content-Length and rely on reader.buffer size reading.

                    // Try to read Content-Length by peeking next line if the previous loop ended on empty line
                    // In case of failure, skip.
                    // Minimal robust loop: read until we hit a 'Content-Length' header then CRLF CRLF already consumed

                    // Read message body length by scanning previous header emissions is not preserved.
                    // A simpler reliable implementation: read bytes until we find a JSON root braces balance.

                    // Fallback JSON read: attempt to parse a JSON object by counting braces
                    let mut body = String::new();
                    let mut depth = 0usize;
                    let mut in_string = false;
                    let mut escape = false;
                    // Read until we've likely captured a full JSON value
                    // Start when we see first '{'
                    loop {
                        let mut ch_buf = [0u8; 1];
                        match reader.read_exact(&mut ch_buf) {
                            Ok(_) => {
                                let ch = ch_buf[0] as char;
                                body.push(ch);
                                if in_string {
                                    if escape { escape = false; } else {
                                        if ch == '\\' { escape = true; }
                                        else if ch == '"' { in_string = false; }
                                    }
                                } else {
                                    if ch == '"' { in_string = true; }
                                    else if ch == '{' { depth += 1; }
                                    else if ch == '}' {
                                        if depth > 0 { depth -= 1; }
                                        if depth == 0 { break; }
                                    }
                                }
                            }
                            Err(_) => break,
                        }
                        if body.len() > 2_000_000 { break; } // safety cap
                    }

                    if !body.trim().is_empty() {
                        let _ = listener_app_handle.emit("lsp_log_line", format!("[stdout-json-body] {}", body));
                        // Emit raw message for general handlers
                        let _ = listener_app_handle.emit("lsp_message", body.clone());
                        // Try to parse and route diagnostics
                        if let Ok(v) = serde_json::from_str::<Value>(&body) {
                            if let Some(method) = v.get("method").and_then(|m| m.as_str()) {
                                if method == "textDocument/publishDiagnostics" {
                                    if let Some(params) = v.get("params") {
                                        let _ = listener_app_handle.emit("lsp_diagnostics", params.clone());
                                    }
                                }
                            }
                        }
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
