// tauri-helpers.js - Centralized Tauri API helpers to avoid import issues

// Ensure Tauri is available
function ensureTauri() {
  if (!window.tauri) {
    throw new Error('Tauri is not available');
  }
  return window.tauri;
}

/**
 * Check if a command exists on the system
 */
export async function checkCommandExists(command) {
  try {
    const tauri = ensureTauri();
    return await tauri.core.invoke('check_command_exists', { command });
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
    const tauri = ensureTauri();
    return await tauri.core.invoke('start_language_server', {
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
    const tauri = ensureTauri();
    return await tauri.core.invoke('send_lsp_request', {
      process_id: processId,
      message
    });
  } catch (error) {
    console.error('Failed to send LSP request:', error);
    throw error;
  }
}

/**
 * Send an LSP notification to a language server process
 */
export async function sendLspNotification(processId, message) {
  try {
    const tauri = ensureTauri();
    await tauri.core.invoke('send_lsp_notification', {
      process_id: processId,
      message
    });
  } catch (error) {
    console.error('Failed to send LSP notification:', error);
    throw error;
  }
}


/**
 * Listen to LSP messages from the backend
 */
export async function listenToLspMessages(handler) {
  try {
    const tauri = ensureTauri();
    return await tauri.event.listen('lsp_message', handler);
  } catch (error) {
    console.error('Failed to listen to LSP messages:', error);
    throw error;
  }
}



/**
 * Write a text file
 */
export async function writeTextFile(filePath, content) {
  try {
    const tauri = ensureTauri();
    return await tauri.core.invoke('write_text_file', {
      filePath,
      content
    });
  } catch (error) {
    console.error('Failed to write file:', error);
    throw error;
  }
}