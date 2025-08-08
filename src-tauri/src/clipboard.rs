use std::sync::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClipboardItem {
    pub file_path: String,
    pub operation: String, // "copy" or "cut"
    pub timestamp: i64,
}

pub type ClipboardState = Mutex<Option<ClipboardItem>>;

#[tauri::command(rename_all = "snake_case")]
pub fn clipboard_copy(
    file_path: String,
    clipboard_state: tauri::State<ClipboardState>,
) -> Result<String, String> {
    let clipboard_item = ClipboardItem {
        file_path: file_path.clone(),
        operation: "copy".to_string(),
        timestamp: chrono::Utc::now().timestamp(),
    };
    
    *clipboard_state.lock().unwrap() = Some(clipboard_item);
    Ok(format!("Copied {} to clipboard", file_path))
}

#[tauri::command(rename_all = "snake_case")]
pub fn clipboard_cut(
    file_path: String,
    clipboard_state: tauri::State<ClipboardState>,
) -> Result<String, String> {
    let clipboard_item = ClipboardItem {
        file_path: file_path.clone(),
        operation: "cut".to_string(),
        timestamp: chrono::Utc::now().timestamp(),
    };
    
    *clipboard_state.lock().unwrap() = Some(clipboard_item);
    Ok(format!("Cut {} to clipboard", file_path))
}

#[tauri::command]
pub fn clipboard_paste(
    dest_path: String,
    clipboard_state: tauri::State<ClipboardState>,
) -> Result<String, String> {
    let clipboard_guard = clipboard_state.lock().unwrap();
    
    if let Some(ref clipboard_item) = *clipboard_guard {
        let source_path = &clipboard_item.file_path;
        let operation = &clipboard_item.operation;
        
        // Clone values before dropping the guard
        let source_path = source_path.clone();
        let operation = operation.clone();
        drop(clipboard_guard);
        
        match operation.as_str() {
            "copy" => crate::file_system::copy_file(source_path.clone(), dest_path),
            "cut" => {
                let result = crate::file_system::move_file(source_path.clone(), dest_path);
                // Clear clipboard after cut operation
                *clipboard_state.lock().unwrap() = None;
                result
            }
            _ => Err("Invalid clipboard operation".to_string()),
        }
    } else {
        Err("Clipboard is empty".to_string())
    }
}

#[tauri::command]
pub fn clipboard_get_status(clipboard_state: tauri::State<ClipboardState>) -> Option<ClipboardItem> {
    clipboard_state.lock().unwrap().clone()
}

#[tauri::command]
pub fn clipboard_clear(clipboard_state: tauri::State<ClipboardState>) -> Result<String, String> {
    *clipboard_state.lock().unwrap() = None;
    Ok("Clipboard cleared".to_string())
}
