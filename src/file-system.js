// file-system.js - Handles file system operations

// Generate a unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Read file content
async function readFile(filePath) {
  try {
    return await window.__TAURI__.core.invoke("read_text_file", { filePath });
  } catch (error) {
    console.error("Failed to read file:", error);
    throw new Error(error);
  }
}

// Write file content
async function writeFile(filePath, content) {
  try {
    await window.__TAURI__.core.invoke("write_text_file", { filePath, content });
    return true;
  } catch (error) {
    console.error("Failed to write file:", error);
    throw new Error(error);
  }
}

// Read directory contents
async function readDirectory(folderPath) {
  try {
    const files = await window.__TAURI__.core.invoke("read_directory", { dirPath: folderPath });
    
    const entries = [];
    const folders = [];
    
    if (!files || !files.length) {
      return entries;
    }
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Use path as ID to ensure consistency with a proper hash
      const id = 'file_' + btoa(file.path).replace(/[^a-zA-Z0-9]/g, '') + '_' + Math.random().toString(36).substr(2, 5);
      const entry = {
        id,
        kind: file.kind,
        name: file.name,
        path: file.path
      };
      
      if (file.kind === 'file') {
        entries.push(entry);
      } else {
        folders.push(entry);
      }
      
      // Store file object in global cache
      window.fileObjects = window.fileObjects || {};
      window.fileObjects[id] = entry;
    }
    
    return [...folders, ...entries];
  } catch (error) {
    console.error("Failed to read directory:", error);
    throw new Error(error);
  }
}

// Check if file exists
async function fileExists(filePath) {
  try {
    return await window.__TAURI__.core.invoke("file_exists", { filePath });
  } catch (error) {
    console.error("Failed to check file existence:", error);
    return false;
  }
}

// Check if path is directory
async function isDirectory(path) {
  try {
    return await window.__TAURI__.core.invoke("is_directory", { path });
  } catch (error) {
    console.error("Failed to check if directory:", error);
    return false;
  }
}

// Get file object from cache
function getFileObject(id) {
  window.fileObjects = window.fileObjects || {};
  return window.fileObjects[id];
}

// Save file object to cache
function saveFileObject(id, fileObject) {
  window.fileObjects = window.fileObjects || {};
  window.fileObjects[id] = fileObject;
}

// Get all files in workspace
async function getWorkspaceFiles(workspacePath) {
  try {
    return await window.__TAURI__.core.invoke("get_workspace_files", { workspacePath });
  } catch (error) {
    console.error("Failed to get workspace files:", error);
    throw new Error(error);
  }
}

// Delete file
async function deleteFile(filePath) {
  try {
    await window.__TAURI__.core.invoke("delete_file", { filePath });
    return true;
  } catch (error) {
    console.error("Failed to delete file:", error);
    throw new Error(error);
  }
}

// Delete directory
async function deleteDirectory(dirPath) {
  try {
    await window.__TAURI__.core.invoke("delete_directory", { dirPath });
    return true;
  } catch (error) {
    console.error("Failed to delete directory:", error);
    throw new Error(error);
  }
}

// Create directory
async function createDirectory(dirPath) {
  try {
    await window.__TAURI__.core.invoke("create_directory", { dirPath });
    return true;
  } catch (error) {
    console.error("Failed to create directory:", error);
    throw new Error(error);
  }
}

// Rename file or directory
async function renameFile(oldPath, newPath) {
  try {
    await window.__TAURI__.core.invoke("rename_file", { oldPath, newPath });
    return true;
  } catch (error) {
    console.error("Failed to rename file:", error);
    throw new Error(error);
  }
}

// Copy file
async function copyFile(sourcePath, destPath) {
  try {
    await window.__TAURI__.core.invoke("copy_file", { sourcePath, destPath });
    return true;
  } catch (error) {
    console.error("Failed to copy file:", error);
    throw new Error(error);
  }
}

// Move file
async function moveFile(sourcePath, destPath) {
  try {
    await window.__TAURI__.core.invoke("move_file", { sourcePath, destPath });
    return true;
  } catch (error) {
    console.error("Failed to move file:", error);
    throw new Error(error);
  }
}

// Clipboard operations
async function clipboardCopy(filePath) {
  try {
    await window.__TAURI__.core.invoke("clipboard_copy", { filePath });
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    throw new Error(error);
  }
}

async function clipboardCut(filePath) {
  try {
    await window.__TAURI__.core.invoke("clipboard_cut", { filePath });
    return true;
  } catch (error) {
    console.error("Failed to cut to clipboard:", error);
    throw new Error(error);
  }
}

async function clipboardPaste(targetDir) {
  try {
    const result = await window.__TAURI__.core.invoke("clipboard_paste", { targetDir });
    return result;
  } catch (error) {
    console.error("Failed to paste from clipboard:", error);
    throw new Error(error);
  }
}

async function clipboardGetStatus() {
  try {
    return await window.__TAURI__.core.invoke("clipboard_get_status");
  } catch (error) {
    console.error("Failed to get clipboard status:", error);
    throw new Error(error);
  }
}

async function clipboardClear() {
  try {
    await window.__TAURI__.core.invoke("clipboard_clear");
    return true;
  } catch (error) {
    console.error("Failed to clear clipboard:", error);
    throw new Error(error);
  }
}

// Search file contents with pattern
async function searchInFiles(workspacePath, query, options = {}) {
  try {
    const {
      useRegex = false,
      caseSensitive = false,
      wholeWord = false,
      maxResults = 100
    } = options;
    
    return await window.__TAURI__.core.invoke("search_in_files", {
      workspacePath,
      query,
      useRegex,
      caseSensitive,
      wholeWord,
      maxResults
    });
  } catch (error) {
    console.error("Failed to search in files:", error);
    throw new Error(error);
  }
}

export { 
  readFile, 
  writeFile, 
  readDirectory, 
  fileExists, 
  isDirectory, 
  getFileObject, 
  saveFileObject, 
  getWorkspaceFiles,
  deleteFile,
  deleteDirectory,
  createDirectory,
  renameFile,
  copyFile,
  moveFile,
  clipboardCopy,
  clipboardCut,
  clipboardPaste,
  clipboardGetStatus,
  clipboardClear,
  searchInFiles
};