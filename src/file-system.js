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
      // Use path as ID to ensure consistency
      const id = btoa(file.path).replace(/[^a-zA-Z0-9]/g, '');
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

export { readFile, writeFile, readDirectory, fileExists, isDirectory, getFileObject, saveFileObject, getWorkspaceFiles };