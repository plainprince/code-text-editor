use std::process::Command;
use tauri::Manager;

#[tauri::command]
pub fn get_app_support_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    match app_handle.path().app_data_dir() {
        Ok(dir) => Ok(dir.to_string_lossy().to_string()),
        Err(e) => Err(format!("Failed to get app support directory: {}", e)),
    }
}

#[tauri::command]
pub fn run_command(command: String, args: Vec<String>, cwd: String) -> Result<String, String> {
    let output = Command::new(command)
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
