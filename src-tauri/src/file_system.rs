use std::fs;
use std::path::Path;
use serde_json::Value;
use tauri::{AppHandle, Manager};

#[tauri::command(rename_all = "snake_case")]
pub fn read_text_file(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))
}

#[tauri::command(rename_all = "snake_case")]
pub fn write_text_file(file_path: String, content: String) -> Result<String, String> {
    if let Some(parent_dir) = Path::new(&file_path).parent() {
        if !parent_dir.exists() {
            fs::create_dir_all(parent_dir)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file {}: {}", file_path, e))?;
    
    Ok(format!("File {} written successfully", file_path))
}

#[tauri::command(rename_all = "snake_case")]
pub fn file_exists(file_path: String) -> bool {
    Path::new(&file_path).exists()
}

#[tauri::command]
pub fn is_directory(path: String) -> bool {
    Path::new(&path).is_dir()
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_file(file_path: String) -> Result<String, String> {
    if !Path::new(&file_path).exists() {
        return Err(format!("File {} does not exist", file_path));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete file {}: {}", file_path, e))?;
    
    Ok(format!("File {} deleted successfully", file_path))
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_directory(dir_path: String) -> Result<String, String> {
    if !Path::new(&dir_path).exists() {
        return Err(format!("Directory {} does not exist", dir_path));
    }

    fs::remove_dir_all(&dir_path)
        .map_err(|e| format!("Failed to delete directory {}: {}", dir_path, e))?;
    
    Ok(format!("Directory {} deleted successfully", dir_path))
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_directory(dir_path: String) -> Result<String, String> {
    fs::create_dir_all(&dir_path)
        .map_err(|e| format!("Failed to create directory {}: {}", dir_path, e))?;
    
    Ok(format!("Directory {} created successfully", dir_path))
}

#[tauri::command(rename_all = "snake_case")]
pub fn rename_file(old_path: String, new_path: String) -> Result<String, String> {
    if !Path::new(&old_path).exists() {
        return Err(format!("Source file {} does not exist", old_path));
    }

    if Path::new(&new_path).exists() {
        return Err(format!("Destination {} already exists", new_path));
    }

    if let Some(parent_dir) = Path::new(&new_path).parent() {
        if !parent_dir.exists() {
            fs::create_dir_all(parent_dir)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename {} to {}: {}", old_path, new_path, e))?;
    
    Ok(format!("Renamed {} to {}", old_path, new_path))
}

#[tauri::command(rename_all = "snake_case")]
pub fn copy_file(source_path: String, dest_path: String) -> Result<String, String> {
    if !Path::new(&source_path).exists() {
        return Err(format!("Source file {} does not exist", source_path));
    }

    if let Some(parent_dir) = Path::new(&dest_path).parent() {
        if !parent_dir.exists() {
            fs::create_dir_all(parent_dir)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Failed to copy {} to {}: {}", source_path, dest_path, e))?;
    
    Ok(format!("Copied {} to {}", source_path, dest_path))
}

#[tauri::command(rename_all = "snake_case")]
pub fn move_file(source_path: String, dest_path: String) -> Result<String, String> {
    if !Path::new(&source_path).exists() {
        return Err(format!("Source file {} does not exist", source_path));
    }

    if let Some(parent_dir) = Path::new(&dest_path).parent() {
        if !parent_dir.exists() {
            fs::create_dir_all(parent_dir)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    fs::rename(&source_path, &dest_path)
        .map_err(|e| format!("Failed to move {} to {}: {}", source_path, dest_path, e))?;
    
    Ok(format!("Moved {} to {}", source_path, dest_path))
}

#[tauri::command(rename_all = "snake_case")]
pub fn read_directory(dir_path: String) -> Result<Value, String> {
    let entries = fs::read_dir(&dir_path)
        .map_err(|e| format!("Failed to read directory {}: {}", dir_path, e))?;

    let mut files = Vec::new();
    let mut folders = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            folders.push(serde_json::json!({
                "name": file_name,
                "type": "directory",
                "path": path.to_string_lossy(),
                "size": null,
                "modified": entry.metadata()
                    .and_then(|m| m.modified())
                    .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
                    .unwrap_or_else(|_| "unknown".to_string())
            }));
        } else {
            let size = entry.metadata()
                .map(|m| m.len())
                .unwrap_or(0);

            files.push(serde_json::json!({
                "name": file_name,
                "type": "file",
                "path": path.to_string_lossy(),
                "size": size,
                "modified": entry.metadata()
                    .and_then(|m| m.modified())
                    .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
                    .unwrap_or_else(|_| "unknown".to_string())
            }));
        }
    }

    Ok(serde_json::json!({
        "files": files,
        "folders": folders
    }))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_workspace_files(workspace_path: String) -> Result<Vec<Value>, String> {
    fn scan_directory(dir: &Path, base_path: &Path, files: &mut Vec<Value>) -> Result<(), std::io::Error> {
        let entries = fs::read_dir(dir)?;
        
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            
            if file_name.starts_with('.') {
                continue;
            }
            
            let relative_path = path.strip_prefix(base_path)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();
            
            if path.is_dir() {
                scan_directory(&path, base_path, files)?;
            } else {
                files.push(serde_json::json!({
                    "name": file_name,
                    "path": path.to_string_lossy(),
                    "relativePath": relative_path,
                    "type": "file"
                }));
            }
        }
        
        Ok(())
    }

    let workspace = Path::new(&workspace_path);
    if !workspace.exists() {
        return Err(format!("Workspace path {} does not exist", workspace_path));
    }

    let mut files = Vec::new();
    scan_directory(workspace, workspace, &mut files)
        .map_err(|e| format!("Failed to scan workspace: {}", e))?;

    Ok(files)
}

#[tauri::command]
pub fn get_settings_file_path(app_handle: AppHandle) -> Result<String, String> {
    match app_handle.path().app_config_dir() {
        Ok(config_dir) => {
            let settings_path = config_dir.join("settings.json");
            Ok(settings_path.to_string_lossy().to_string())
        },
        Err(e) => Err(format!("Failed to get config directory: {}", e)),
    }
}
