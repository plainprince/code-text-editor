use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchMatch {
    pub line: u32,
    pub column: u32,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub file_path: String,
    pub relative_path: String,
    pub matches: Vec<SearchMatch>,
}

#[tauri::command]
pub fn search_in_files(
    workspace_path: String,
    query: String,
    use_regex: bool,
    case_sensitive: bool,
    whole_word: bool,
    max_results: usize,
) -> Result<Vec<SearchResult>, String> {
    // Simplified implementation
    Ok(vec![])
}
