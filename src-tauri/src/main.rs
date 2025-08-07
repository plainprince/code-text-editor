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
use std::io::{Read, Write};
use std::process::{Command, Stdio, Child};
use serde::{Deserialize, Serialize};
use chrono::Utc;
use tree_sitter::{Language, Parser, Node, Tree};

// Language Server Management
#[derive(Debug, Clone, Serialize, Deserialize)]
struct LanguageServerProcess {
    id: String,
    command: String,
    args: Vec<String>,
    language: String,
}

type LanguageServerMap = Arc<Mutex<HashMap<String, Child>>>;

// Tree-sitter language functions
fn get_language(language_id: &str) -> Result<Language, String> {
    match language_id {
        "javascript" | "jsx" => Ok(tree_sitter_javascript::LANGUAGE.into()),
        "typescript" => Ok(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
        "tsx" => Ok(tree_sitter_typescript::LANGUAGE_TSX.into()),
        "python" => Ok(tree_sitter_python::LANGUAGE.into()),
        "rust" => Ok(tree_sitter_rust::LANGUAGE.into()),
        "go" => Ok(tree_sitter_go::LANGUAGE.into()),
        _ => Err(format!("Unsupported language: {}", language_id)),
    }
}

// Symbol information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
struct DocumentSymbol {
    name: String,
    kind: u8, // SymbolKind as number
    range: Range,
    selection_range: Range,
    children: Vec<DocumentSymbol>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Range {
    start_line_number: u32,
    start_column: u32,
    end_line_number: u32,
    end_column: u32,
}

// File system commands
#[tauri::command(rename_all = "snake_case")]
fn read_text_file(file_path: String) -> Result<String, String> {
    match fs::read_to_string(&file_path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read file {}: {}", file_path, e))
    }
}

#[tauri::command(rename_all = "snake_case")]
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

#[tauri::command(rename_all = "snake_case")]
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

#[tauri::command(rename_all = "snake_case")]
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



#[tauri::command(rename_all = "snake_case")]
fn delete_file(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    
    if path.is_dir() {
        return Err(format!("Path is a directory, use delete_directory instead: {}", file_path));
    }
    
    match fs::remove_file(path) {
        Ok(_) => Ok("File deleted successfully".to_string()),
        Err(e) => Err(format!("Failed to delete file {}: {}", file_path, e))
    }
}

#[tauri::command(rename_all = "snake_case")]
fn delete_directory(dir_path: String) -> Result<String, String> {
    let path = Path::new(&dir_path);
    
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }
    
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path));
    }
    
    match fs::remove_dir_all(path) {
        Ok(_) => Ok("Directory deleted successfully".to_string()),
        Err(e) => Err(format!("Failed to delete directory {}: {}", dir_path, e))
    }
}

#[tauri::command(rename_all = "snake_case")]
fn create_directory(dir_path: String) -> Result<String, String> {
    let path = Path::new(&dir_path);
    
    if path.exists() {
        return Err(format!("Path already exists: {}", dir_path));
    }
    
    match fs::create_dir_all(path) {
        Ok(_) => Ok("Directory created successfully".to_string()),
        Err(e) => Err(format!("Failed to create directory {}: {}", dir_path, e))
    }
}

#[tauri::command(rename_all = "snake_case")]
fn rename_file(old_path: String, new_path: String) -> Result<String, String> {
    let old = Path::new(&old_path);
    let new = Path::new(&new_path);
    
    if !old.exists() {
        return Err(format!("Source path does not exist: {}", old_path));
    }
    
    if new.exists() {
        return Err(format!("Destination path already exists: {}", new_path));
    }
    
    // Create parent directories for new path if they don't exist
    if let Some(parent) = new.parent() {
        if !parent.exists() {
            if let Err(e) = fs::create_dir_all(parent) {
                return Err(format!("Failed to create parent directories: {}", e));
            }
        }
    }
    
    match fs::rename(old, new) {
        Ok(_) => Ok("File renamed successfully".to_string()),
        Err(e) => Err(format!("Failed to rename {} to {}: {}", old_path, new_path, e))
    }
}

#[tauri::command(rename_all = "snake_case")]
fn copy_file(source_path: String, dest_path: String) -> Result<String, String> {
    let source = Path::new(&source_path);
    let dest = Path::new(&dest_path);
    
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }
    
    if !source.is_file() {
        return Err(format!("Source is not a file: {}", source_path));
    }
    
    if dest.exists() {
        return Err(format!("Destination already exists: {}", dest_path));
    }
    
    // Create parent directories for destination if they don't exist
    if let Some(parent) = dest.parent() {
        if !parent.exists() {
            if let Err(e) = fs::create_dir_all(parent) {
                return Err(format!("Failed to create parent directories: {}", e));
            }
        }
    }
    
    match fs::copy(source, dest) {
        Ok(_) => Ok("File copied successfully".to_string()),
        Err(e) => Err(format!("Failed to copy {} to {}: {}", source_path, dest_path, e))
    }
}

#[tauri::command(rename_all = "snake_case")]
fn move_file(source_path: String, dest_path: String) -> Result<String, String> {
    let source = Path::new(&source_path);
    let dest = Path::new(&dest_path);
    
    if !source.exists() {
        return Err(format!("Source path does not exist: {}", source_path));
    }
    
    if dest.exists() {
        return Err(format!("Destination already exists: {}", dest_path));
    }
    
    // Create parent directories for destination if they don't exist
    if let Some(parent) = dest.parent() {
        if !parent.exists() {
            if let Err(e) = fs::create_dir_all(parent) {
                return Err(format!("Failed to create parent directories: {}", e));
            }
        }
    }
    
    match fs::rename(source, dest) {
        Ok(_) => Ok("File moved successfully".to_string()),
        Err(e) => Err(format!("Failed to move {} to {}: {}", source_path, dest_path, e))
    }
}

#[tauri::command(rename_all = "snake_case")]
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

#[tauri::command(rename_all = "snake_case")]
fn clipboard_copy(file_path: String, clipboard_state: tauri::State<ClipboardState>) -> Result<String, String> {
    let mut clipboard = clipboard_state.lock().map_err(|e| format!("Failed to lock clipboard: {}", e))?;
    *clipboard = Some(ClipboardItem {
        path: file_path.clone(),
        is_cut: false,
    });
    Ok(format!("Copied {} to clipboard", file_path))
}

#[tauri::command(rename_all = "snake_case")]
fn clipboard_cut(file_path: String, clipboard_state: tauri::State<ClipboardState>) -> Result<String, String> {
    let mut clipboard = clipboard_state.lock().map_err(|e| format!("Failed to lock clipboard: {}", e))?;
    *clipboard = Some(ClipboardItem {
        path: file_path.clone(),
        is_cut: true,
    });
    Ok(format!("Cut {} to clipboard", file_path))
}

#[tauri::command(rename_all = "snake_case")]
fn clipboard_paste(target_dir: String, clipboard_state: tauri::State<ClipboardState>) -> Result<String, String> {
    let mut clipboard = clipboard_state.lock().map_err(|e| format!("Failed to lock clipboard: {}", e))?;
    
    let clipboard_item = match clipboard.take() {
        Some(item) => item,
        None => return Err("Clipboard is empty".to_string()),
    };
    
    let source_path = Path::new(&clipboard_item.path);
    if !source_path.exists() {
        return Err(format!("Source file no longer exists: {}", clipboard_item.path));
    }
    
    let file_name = source_path.file_name()
        .ok_or("Invalid source file name")?
        .to_string_lossy();
    
    let target_path = Path::new(&target_dir).join(&*file_name);
    
    // Handle name conflicts
    let mut final_target_path = target_path.clone();
    let mut counter = 1;
    while final_target_path.exists() {
        let stem = source_path.file_stem().unwrap_or_default().to_string_lossy();
        let extension = source_path.extension()
            .map(|ext| format!(".{}", ext.to_string_lossy()))
            .unwrap_or_default();
        
        let new_name = if source_path.is_dir() {
            format!("{} ({})", stem, counter)
        } else {
            format!("{} ({}){}", stem, counter, extension)
        };
        
        final_target_path = Path::new(&target_dir).join(new_name);
        counter += 1;
        
        if counter > 100 {
            return Err("Too many name conflicts".to_string());
        }
    }
    
    if clipboard_item.is_cut {
        // Move operation
        if source_path.is_dir() {
            // For directories, we need to recursively move
            copy_dir_recursively(source_path, &final_target_path)?;
            fs::remove_dir_all(source_path)
                .map_err(|e| format!("Failed to remove source directory: {}", e))?;
        } else {
            fs::rename(source_path, &final_target_path)
                .map_err(|e| format!("Failed to move file: {}", e))?;
        }
        Ok(format!("Moved {} to {}", clipboard_item.path, final_target_path.display()))
    } else {
        // Copy operation
        if source_path.is_dir() {
            copy_dir_recursively(source_path, &final_target_path)?;
        } else {
            fs::copy(source_path, &final_target_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
        
        // For copy operations, put the item back in clipboard for multiple pastes
        *clipboard = Some(ClipboardItem {
            path: clipboard_item.path.clone(),
            is_cut: clipboard_item.is_cut,
        });
        Ok(format!("Copied {} to {}", source_path.display(), final_target_path.display()))
    }
}

#[tauri::command]
fn clipboard_get_status(clipboard_state: tauri::State<ClipboardState>) -> Result<Option<(String, bool)>, String> {
    let clipboard = clipboard_state.lock().map_err(|e| format!("Failed to lock clipboard: {}", e))?;
    match &*clipboard {
        Some(item) => Ok(Some((item.path.clone(), item.is_cut))),
        None => Ok(None),
    }
}

#[tauri::command]
fn clipboard_clear(clipboard_state: tauri::State<ClipboardState>) -> Result<String, String> {
    let mut clipboard = clipboard_state.lock().map_err(|e| format!("Failed to lock clipboard: {}", e))?;
    *clipboard = None;
    Ok("Clipboard cleared".to_string())
}

// Helper function to recursively copy directories
fn copy_dir_recursively(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.is_dir() {
        return Err(format!("Source is not a directory: {}", src.display()));
    }
    
    fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create target directory: {}", e))?;
    
    let entries = fs::read_dir(src)
        .map_err(|e| format!("Failed to read source directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if src_path.is_dir() {
            copy_dir_recursively(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy file {} to {}: {}", src_path.display(), dst_path.display(), e))?;
        }
    }
    
    Ok(())
}

// Terminal state management

struct TerminalSession {
    pty_pair: portable_pty::PtyPair,
    writer: Option<Box<dyn Write + Send>>,
}

type TerminalSessions = Arc<Mutex<HashMap<String, Arc<Mutex<TerminalSession>>>>>;

// Clipboard state management
#[derive(Debug, Clone)]
struct ClipboardItem {
    path: String,
    is_cut: bool, // true for cut, false for copy
}

type ClipboardState = Arc<Mutex<Option<ClipboardItem>>>;

#[tauri::command]
async fn create_terminal_session(
    session_id: String,
    working_directory: Option<String>,
    app_handle: AppHandle,
    sessions: tauri::State<'_, TerminalSessions>,
) -> Result<String, String> {
    use portable_pty::{CommandBuilder, PtySize};
    
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
    let mut shell = if cfg!(windows) {
        CommandBuilder::new("cmd.exe")
    } else {
        // Try to use user's shell from environment, fallback to sh
        let shell_path = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
        CommandBuilder::new(shell_path)
    };

    // Set working directory if provided
    if let Some(cwd) = working_directory {
        shell.cwd(cwd);
    }

    // Spawn the shell
    let _child = pty_pair
        .slave
        .spawn_command(shell)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Get writer before storing
    let writer = pty_pair.master.take_writer().ok();
    
    // Store the session
    let terminal_session = TerminalSession {
        pty_pair,
        writer,
    };
    let terminal_session = Arc::new(Mutex::new(terminal_session));
    sessions.lock().unwrap().insert(session_id.clone(), terminal_session.clone());

    // Start reading from the pty and emit events
    let app_handle_clone = app_handle.clone();
    let session_id_clone = session_id.clone();
    let terminal_session_clone = terminal_session.clone();
    
    tokio::spawn(async move {
        let mut reader = {
            let session = terminal_session_clone.lock().unwrap();
            session.pty_pair.master.try_clone_reader().unwrap()
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
    
    let sessions = sessions.lock().unwrap();
    if let Some(terminal_session) = sessions.get(&session_id) {
        let mut session = terminal_session.lock().unwrap();
        if let Some(ref mut writer) = session.writer {
            writer.write_all(data.as_bytes()).map_err(|e| format!("Failed to write: {}", e))?;
            writer.flush().map_err(|e| format!("Failed to flush: {}", e))?;
            Ok(())
        } else {
            Err("Terminal writer not available".to_string())
        }
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
    if let Some(terminal_session) = sessions.get(&session_id) {
        let session = terminal_session.lock().unwrap();
        session.pty_pair.master.resize(PtySize {
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

// Search in files command
#[derive(serde::Serialize)]
struct SearchMatch {
    #[serde(rename = "lineNumber")]
    line_number: usize,
    column: usize,
    text: String,
}

#[derive(serde::Serialize)]
struct SearchResult {
    path: String,
    name: String,
    #[serde(rename = "relativePath")]
    relative_path: String,
    matches: Vec<SearchMatch>,
}

#[tauri::command]
fn search_in_files(
    workspace_path: String,
    query: String,
    use_regex: bool,
    case_sensitive: bool,
    whole_word: bool,
    max_results: usize,
) -> Result<Vec<SearchResult>, String> {
    use std::path::Path;
    use regex::Regex;
    
    if query.is_empty() {
        return Ok(vec![]);
    }
    
    let workspace = Path::new(&workspace_path);
    if !workspace.exists() || !workspace.is_dir() {
        return Err("Invalid workspace path".to_string());
    }
    
    // Create regex pattern
    let pattern = if use_regex {
        query.clone()
    } else {
        // Escape regex special characters
        let escaped = regex::escape(&query);
        if whole_word {
            format!(r"\b{}\b", escaped)
        } else {
            escaped
        }
    };
    
    let regex = match if case_sensitive {
        Regex::new(&pattern)
    } else {
        regex::RegexBuilder::new(&pattern)
            .case_insensitive(true)
            .build()
    } {
        Ok(r) => r,
        Err(e) => return Err(format!("Invalid regex pattern: {}", e)),
    };
    
    let mut results = Vec::new();
    let mut total_matches = 0;
    
    // Walk through directory recursively
    if let Err(e) = walk_directory(
        workspace,
        workspace,
        &regex,
        &mut results,
        &mut total_matches,
        max_results,
    ) {
        return Err(format!("Search failed: {}", e));
    }
    
    Ok(results)
}

fn walk_directory(
    current_path: &Path,
    workspace_root: &Path,
    regex: &regex::Regex,
    results: &mut Vec<SearchResult>,
    total_matches: &mut usize,
    max_results: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    if *total_matches >= max_results {
        return Ok(());
    }
    
    for entry in fs::read_dir(current_path)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_dir() {
            // Skip hidden directories and common ignored directories
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('.') || 
                   name == "node_modules" || 
                   name == "target" || 
                   name == "dist" || 
                   name == "build" {
                    continue;
                }
            }
            walk_directory(&path, workspace_root, regex, results, total_matches, max_results)?;
        } else if path.is_file() {
            // Only search text files
            if let Some(extension) = path.extension().and_then(|e| e.to_str()) {
                let text_extensions = [
                    "txt", "md", "rs", "js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "h", "hpp",
                    "css", "scss", "sass", "html", "htm", "xml", "json", "yaml", "yml", "toml",
                    "go", "php", "rb", "swift", "kt", "scala", "sh", "bash", "zsh", "fish",
                    "sql", "csv", "log", "config", "conf", "ini", "env"
                ];
                
                if !text_extensions.contains(&extension.to_lowercase().as_str()) {
                    continue;
                }
            } else {
                // Skip files without extensions (likely binary)
                continue;
            }
            
            if let Ok(content) = fs::read_to_string(&path) {
                let matches = search_in_content(&content, regex);
                if !matches.is_empty() {
                    let relative_path = path.strip_prefix(workspace_root)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .to_string();
                    
                    let name = path.file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    
                    results.push(SearchResult {
                        path: path.to_string_lossy().to_string(),
                        name,
                        relative_path,
                        matches,
                    });
                    
                    *total_matches += 1;
                    if *total_matches >= max_results {
                        break;
                    }
                }
            }
        }
    }
    
    Ok(())
}

fn search_in_content(content: &str, regex: &regex::Regex) -> Vec<SearchMatch> {
    let mut matches = Vec::new();
    
    for (line_num, line) in content.lines().enumerate() {
        for mat in regex.find_iter(line) {
            matches.push(SearchMatch {
                line_number: line_num + 1,
                column: mat.start() + 1,
                text: line.to_string(),
            });
            
            // Limit matches per file
            if matches.len() >= 10 {
                return matches;
            }
        }
    }
    
    matches
}

// Command existence check
#[tauri::command]
fn check_command_exists(command: String) -> Result<bool, String> {
    // Cross-platform command existence check
    let cmd = if cfg!(target_os = "windows") {
        Command::new("where")
            .arg(&command)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
    } else {
        Command::new("which")
            .arg(&command)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
    };

    match cmd {
        Ok(status) => Ok(status.success()),
        Err(_) => Ok(false),
    }
}

// Tree-sitter Commands
#[tauri::command]
fn parse_document_symbols(
    source_code: String,
    language_id: String,
    _file_path: String
) -> Result<Vec<DocumentSymbol>, String> {
    let language = get_language(&language_id)?;

    let mut parser = Parser::new();
    parser.set_language(&language)
        .map_err(|e| format!("Failed to set language: {}", e))?;

    let tree = parser.parse(&source_code, None)
        .ok_or("Failed to parse source code")?;

    let symbols = extract_symbols_from_tree(&tree, &source_code, &language_id);
    Ok(symbols)
}

fn extract_symbols_from_tree(tree: &Tree, source_code: &str, language_id: &str) -> Vec<DocumentSymbol> {
    let root_node = tree.root_node();
    let mut symbols = Vec::new();
    
    match language_id {
        "javascript" | "jsx" | "typescript" | "tsx" => {
            extract_js_symbols(root_node, source_code, &mut symbols);
        },
        "python" => {
            extract_python_symbols(root_node, source_code, &mut symbols);
        },
        "rust" => {
            extract_rust_symbols(root_node, source_code, &mut symbols);
        },
        "go" => {
            extract_go_symbols(root_node, source_code, &mut symbols);
        },
        _ => {
            extract_generic_symbols(root_node, source_code, &mut symbols);
        }
    }
    
    symbols
}

fn extract_js_symbols(node: Node, source_code: &str, symbols: &mut Vec<DocumentSymbol>) {
    let mut cursor = node.walk();
    
    for child in node.children(&mut cursor) {
        match child.kind() {
            "function_declaration" | "function" | "arrow_function" | "method_definition" => {
                if let Some(symbol) = create_js_function_symbol(child, source_code) {
                    symbols.push(symbol);
                }
            },
            "class_declaration" => {
                if let Some(symbol) = create_js_class_symbol(child, source_code) {
                    symbols.push(symbol);
                }
            },
            "variable_declaration" => {
                extract_js_variables(child, source_code, symbols);
            },
            _ => {
                // Recursively check children
                extract_js_symbols(child, source_code, symbols);
            }
        }
    }
}

fn create_js_function_symbol(node: Node, source_code: &str) -> Option<DocumentSymbol> {
    let name = find_function_name(node, source_code)?;
    let range = node_to_range(node);
    let selection_range = range.clone();
    
    let mut children = Vec::new();
    extract_js_symbols(node, source_code, &mut children);
    
    Some(DocumentSymbol {
        name,
        kind: 12, // Function
        range,
        selection_range,
        children,
    })
}

fn create_js_class_symbol(node: Node, source_code: &str) -> Option<DocumentSymbol> {
    let name = find_class_name(node, source_code)?;
    let range = node_to_range(node);
    let selection_range = range.clone();
    
    let mut children = Vec::new();
    
    // Extract methods and properties from class body
    if let Some(body) = node.child_by_field_name("body") {
        extract_js_symbols(body, source_code, &mut children);
    }
    
    Some(DocumentSymbol {
        name,
        kind: 5, // Class
        range,
        selection_range,
        children,
    })
}

fn extract_js_variables(node: Node, source_code: &str, symbols: &mut Vec<DocumentSymbol>) {
    let mut cursor = node.walk();
    
    for child in node.children(&mut cursor) {
        if child.kind() == "variable_declarator" {
            if let Some(name_node) = child.child_by_field_name("name") {
                let name = name_node.utf8_text(source_code.as_bytes()).unwrap_or("unknown").to_string();
                let range = node_to_range(child);
                
                symbols.push(DocumentSymbol {
                    name,
                    kind: 13, // Variable
                    range: range.clone(),
                    selection_range: range,
                    children: Vec::new(),
                });
            }
        }
    }
}

fn find_function_name(node: Node, source_code: &str) -> Option<String> {
    // Try to find name field first
    if let Some(name_node) = node.child_by_field_name("name") {
        return Some(name_node.utf8_text(source_code.as_bytes()).unwrap_or("anonymous").to_string());
    }
    
    // For arrow functions and other patterns, look for identifier
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "identifier" {
            return Some(child.utf8_text(source_code.as_bytes()).unwrap_or("anonymous").to_string());
        }
    }
    
    Some("anonymous".to_string())
}

fn find_class_name(node: Node, source_code: &str) -> Option<String> {
    if let Some(name_node) = node.child_by_field_name("name") {
        return Some(name_node.utf8_text(source_code.as_bytes()).unwrap_or("unnamed").to_string());
    }
    None
}

fn node_to_range(node: Node) -> Range {
    let start = node.start_position();
    let end = node.end_position();
    
    Range {
        start_line_number: start.row as u32 + 1,
        start_column: start.column as u32 + 1,
        end_line_number: end.row as u32 + 1,
        end_column: end.column as u32 + 1,
    }
}

// Placeholder implementations for other languages
fn extract_python_symbols(node: Node, source_code: &str, symbols: &mut Vec<DocumentSymbol>) {
    // TODO: Implement Python symbol extraction
    extract_generic_symbols(node, source_code, symbols);
}

fn extract_rust_symbols(node: Node, source_code: &str, symbols: &mut Vec<DocumentSymbol>) {
    // TODO: Implement Rust symbol extraction  
    extract_generic_symbols(node, source_code, symbols);
}

fn extract_go_symbols(node: Node, source_code: &str, symbols: &mut Vec<DocumentSymbol>) {
    // TODO: Implement Go symbol extraction
    extract_generic_symbols(node, source_code, symbols);
}

fn extract_generic_symbols(node: Node, source_code: &str, symbols: &mut Vec<DocumentSymbol>) {
    let mut cursor = node.walk();
    
    for child in node.children(&mut cursor) {
        let kind_str = child.kind();
        
        // Generic patterns for functions and classes
        if kind_str.contains("function") || kind_str.contains("method") {
            if let Some(name) = get_generic_name(child, source_code) {
                symbols.push(DocumentSymbol {
                    name,
                    kind: 12, // Function
                    range: node_to_range(child),
                    selection_range: node_to_range(child),
                    children: Vec::new(),
                });
            }
        } else if kind_str.contains("class") || kind_str.contains("struct") {
            if let Some(name) = get_generic_name(child, source_code) {
                symbols.push(DocumentSymbol {
                    name,
                    kind: 5, // Class
                    range: node_to_range(child),
                    selection_range: node_to_range(child),
                    children: Vec::new(),
                });
            }
        } else {
            // Recurse into children
            extract_generic_symbols(child, source_code, symbols);
        }
    }
}

fn get_generic_name(node: Node, source_code: &str) -> Option<String> {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "identifier" {
            return Some(child.utf8_text(source_code.as_bytes()).unwrap_or("unnamed").to_string());
        }
    }
    None
}

// Language Server Commands
#[tauri::command(rename_all = "snake_case")]
async fn start_language_server(
    command: String,
    args: Vec<String>,
    language: String,
    state: tauri::State<'_, LanguageServerMap>
) -> Result<String, String> {
    let process_id = format!("{}_{}", language, Utc::now().timestamp_millis());
    
    let mut cmd = Command::new(&command);
    cmd.args(&args)
       .stdin(Stdio::piped())
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());
    
    match cmd.spawn() {
        Ok(child) => {
            let mut processes = state.lock().map_err(|e| format!("Failed to lock processes: {}", e))?;
            processes.insert(process_id.clone(), child);
            Ok(process_id)
        },
        Err(e) => Err(format!("Failed to start language server '{}': {}", command, e))
    }
}

#[tauri::command(rename_all = "snake_case")]
async fn send_lsp_request(
    process_id: String,
    message: String,
    state: tauri::State<'_, LanguageServerMap>
) -> Result<String, String> {
    let mut processes = state.lock().map_err(|e| format!("Failed to lock processes: {}", e))?;
    
    if let Some(process) = processes.get_mut(&process_id) {
        if let Some(stdin) = process.stdin.as_mut() {
            let request = format!("Content-Length: {}\r\n\r\n{}", message.len(), message);
            stdin.write_all(request.as_bytes()).map_err(|e| format!("Failed to write to process: {}", e))?;
            stdin.flush().map_err(|e| format!("Failed to flush stdin: {}", e))?;
            
            // Try to read response from stdout
            if let Some(stdout) = process.stdout.as_mut() {
                let mut all_data = Vec::new();
                let mut attempts = 0;
                const MAX_ATTEMPTS: usize = 10;
                
                // Read multiple times to capture all LSP messages
                while attempts < MAX_ATTEMPTS {
                    let mut buffer = vec![0; 4096];
                    match stdout.read(&mut buffer) {
                        Ok(bytes_read) if bytes_read > 0 => {
                            all_data.extend_from_slice(&buffer[..bytes_read]);
                            attempts += 1;
                            
                            // Small delay to allow more data to arrive
                            std::thread::sleep(std::time::Duration::from_millis(10));
                        },
                        Ok(0) => {
                            // No data available, but don't break immediately
                            attempts += 1;
                            std::thread::sleep(std::time::Duration::from_millis(50));
                        },
                        Ok(_) => {
                            // This case should never happen since we covered bytes_read > 0 and == 0
                            // But added for completeness to satisfy the compiler
                            attempts += 1;
                            std::thread::sleep(std::time::Duration::from_millis(50));
                        },
                        Err(_) => break,
                    }
                }
                
                if !all_data.is_empty() {
                    let full_response = String::from_utf8_lossy(&all_data);
                    
                    // Parse multiple LSP messages - look for the actual response (not log messages)
                    let mut best_response = None;
                    let mut current_pos = 0;
                    
                    while let Some(content_length_pos) = full_response[current_pos..].find("Content-Length:") {
                        let abs_pos = current_pos + content_length_pos;
                        if let Some(header_end) = full_response[abs_pos..].find("\r\n\r\n") {
                            let json_start = abs_pos + header_end + 4;
                            if let Some(json_end) = full_response[json_start..].find("\r\n\r\n").or_else(|| {
                                // Try to find next Content-Length or end of string
                                full_response[json_start..].find("Content-Length:").or_else(|| {
                                    Some(full_response.len() - json_start)
                                })
                            }) {
                                let json_part = &full_response[json_start..json_start + json_end];
                                
                                // Try to parse as JSON to see if it's valid
                                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_part) {
                                    // Prefer responses with "result" or "error" (actual responses)
                                    // Skip "window/logMessage" and other notifications
                                    if parsed.get("method").and_then(|m| m.as_str()) != Some("window/logMessage") {
                                        if parsed.get("result").is_some() || parsed.get("error").is_some() {
                                            best_response = Some(json_part.to_string());
                                            break;
                                        } else if best_response.is_none() {
                                            // Keep any non-log message as fallback
                                            best_response = Some(json_part.to_string());
                                        }
                                    }
                                }
                                current_pos = json_start + json_end;
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                    
                    if let Some(response) = best_response {
                        Ok(response)
                    } else {
                        // Fallback: return the first valid JSON we find
                        if let Some(json_start) = full_response.find('{') {
                            let remaining = &full_response[json_start..];
                            if let Some(json_end) = remaining.find("\r\n\r\n").or_else(|| remaining.find("Content-Length:")) {
                                Ok(remaining[..json_end].to_string())
                            } else {
                                Ok(remaining.to_string())
                            }
                        } else {
                            Ok(r#"{"jsonrpc": "2.0", "id": 1, "result": []}"#.to_string())
                        }
                    }
                } else {
                    // Return mock response with realistic structure
                    Ok(r#"{"jsonrpc": "2.0", "id": 1, "result": []}"#.to_string())
                }
            } else {
                // Return mock response if no stdout
                Ok(r#"{"jsonrpc": "2.0", "id": 1, "result": []}"#.to_string())
            }
        } else {
            Err("Process stdin not available".to_string())
        }
    } else {
        Err(format!("Language server process not found: {}", process_id))
    }
}

#[tauri::command(rename_all = "snake_case")]
async fn stop_language_server(
    process_id: String,
    state: tauri::State<'_, LanguageServerMap>
) -> Result<String, String> {
    let mut processes = state.lock().map_err(|e| format!("Failed to lock processes: {}", e))?;
    
    if let Some(mut process) = processes.remove(&process_id) {
        match process.kill() {
            Ok(_) => Ok("Language server stopped".to_string()),
            Err(e) => Err(format!("Failed to stop language server: {}", e))
        }
    } else {
        Err(format!("Language server process not found: {}", process_id))
    }
}

fn main() {
    let terminal_sessions: TerminalSessions = Arc::new(Mutex::new(HashMap::new()));
    let clipboard_state: ClipboardState = Arc::new(Mutex::new(None));
    let language_servers: LanguageServerMap = Arc::new(Mutex::new(HashMap::new()));
    
    tauri::Builder::default()
        .manage(terminal_sessions)
        .manage(clipboard_state)
        .manage(language_servers)
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            read_directory,
            file_exists,
            is_directory,
            get_settings_file_path,
            get_workspace_files,
            delete_file,
            delete_directory,
            create_directory,
            rename_file,
            copy_file,
            move_file,
            clipboard_copy,
            clipboard_cut,
            clipboard_paste,
            clipboard_get_status,
            clipboard_clear,
            create_terminal_session,
            write_to_terminal,
            close_terminal_session,
            resize_terminal,
            search_in_files,
            start_language_server,
            send_lsp_request,
            stop_language_server,
            check_command_exists,
            parse_document_symbols
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
