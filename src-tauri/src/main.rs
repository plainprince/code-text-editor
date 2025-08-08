#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod file_system;
mod language_server;
mod clipboard;
mod tree_sitter_parser;
mod utils;
mod terminal;
mod search;

use language_server::LanguageServerMap;
use clipboard::ClipboardState;
use terminal::TerminalMap;

fn main() {
    tauri::Builder::default()
        .manage(LanguageServerMap::default())
        .manage(ClipboardState::default())
        .manage(TerminalMap::default())
        .invoke_handler(tauri::generate_handler![
            // File system operations
            file_system::read_text_file,
            file_system::write_text_file,
            file_system::file_exists,
            file_system::is_directory,
            file_system::delete_file,
            file_system::delete_directory,
            file_system::create_directory,
            file_system::rename_file,
            file_system::copy_file,
            file_system::move_file,
            file_system::read_directory,
            file_system::get_workspace_files,
            file_system::get_settings_file_path,
            
            // Language server operations
            language_server::check_command_exists,
            language_server::start_language_server,
            language_server::send_lsp_request,
            language_server::send_lsp_notification,
            language_server::shutdown_all_language_servers,
            
            // Clipboard operations
            clipboard::clipboard_copy,
            clipboard::clipboard_cut,
            clipboard::clipboard_paste,
            clipboard::clipboard_get_status,
            clipboard::clipboard_clear,
            
            // Tree-sitter parsing
            tree_sitter_parser::parse_document_symbols,
            
            // Terminal operations
            terminal::create_terminal_session,
            terminal::write_to_terminal,
            terminal::close_terminal_session,
            terminal::resize_terminal,
            
            // Search operations
            search::search_in_files,
            
            // Utility functions
            utils::get_app_support_dir,
            utils::run_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
