// tauri-helpers.js - Centralized Tauri API helpers to avoid import issues

/**
 * Check if a command exists on the system
 */
export async function checkCommandExists(command) {
  try {
    return await window.__TAURI__.core.invoke('check_command_exists', { command });
  } catch (error) {
    console.error('Failed to check command:', error);
    return false;
  }
}

/**
 * Start a language server process
 */
export async function startLanguageServer(command, args, language) {
  try {
    return await window.__TAURI__.core.invoke('start_language_server', {
      command,
      args,
      language
    });
  } catch (error) {
    console.error('Failed to start language server:', error);
    throw error;
  }
}

/**
 * Send an LSP request to a language server process
 */
export async function sendLspRequest(processId, message) {
  try {
    return await window.__TAURI__.core.invoke('send_lsp_request', {
      process_id: processId,
      message
    });
  } catch (error) {
    console.error('Failed to send LSP request:', error);
    throw error;
  }
}

/**
 * Write a text file
 */
export async function writeTextFile(filePath, content) {
  try {
    return await window.__TAURI__.core.invoke('write_text_file', {
      filePath,
      content
    });
  } catch (error) {
    console.error('Failed to write file:', error);
    throw error;
  }
}