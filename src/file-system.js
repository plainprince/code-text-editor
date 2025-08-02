// file-system.js - Handles file system operations

// Generate a unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Read file content
async function readFile(filePath) {
  try {
    const { invoke } = window.__TAURI__.core;
    return await invoke("get_file_content", { filePath });
  } catch (error) {
    console.error("Failed to read file:", error);
    throw error;
  }
}

// Write file content
async function writeFile(filePath, content) {
  try {
    const { invoke } = window.__TAURI__.core;
    const result = await invoke("write_file", { filePath, content });
    return result === "OK";
  } catch (error) {
    console.error("Failed to write file:", error);
    throw error;
  }
}

// Read directory contents
async function readDirectory(folderPath) {
  try {
    const { invoke } = window.__TAURI__.core;
    const message = await invoke("open_folder", { folderPath });
    const files = JSON.parse(message.replaceAll('\\', '/').replaceAll('//', '/'));
    
    const entries = [];
    const folders = [];
    
    if (!files || !files.length) {
      return entries;
    }
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = generateId();
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
    throw error;
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

export { readFile, writeFile, readDirectory, getFileObject, saveFileObject };