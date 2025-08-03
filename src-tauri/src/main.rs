#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod fc;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn open_folder(folder_path: &str) -> String {
    let files = fc::read_directory(folder_path);
    files
}

#[tauri::command]
fn get_file_content(file_path: &str) -> String {
    let content = fc::read_file(file_path);
    content
}

#[tauri::command]
fn write_file(file_path: &str, content: &str) -> String {
    fc::write_file(file_path, content);
    String::from("OK")
}

#[tauri::command]
fn create_directory(dir_path: &str) -> Result<(), String> {
    fc::create_directory(dir_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_file(file_path: &str) -> Result<(), String> {
    fc::remove_file(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_folder(folder_path: &str) -> Result<(), String> {
    fc::remove_folder(folder_path).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet, 
            open_folder, 
            get_file_content, 
            write_file,
            create_directory,
            remove_file,
            remove_folder
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
