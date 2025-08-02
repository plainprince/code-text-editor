// file-explorer.js - Handles file explorer UI and functionality

import { readDirectory, getFileObject, readFile } from './file-system.js';

class FileExplorer {
  constructor() {
    this.rootFolder = null;
    this.files = [];
    this.container = document.querySelector("#project-panel .sidebar-panel-content");
    this.openedFiles = [];
    this.selectedFile = null;
    
    // Bind methods
    this.openFolder = this.openFolder.bind(this);
    this.renderFileTree = this.renderFileTree.bind(this);
    this.createFileTreeItem = this.createFileTreeItem.bind(this);
    this.openFile = this.openFile.bind(this);
    this.saveFile = this.saveFile.bind(this);
  }
  
  // Open a folder and load its contents
  async openFolder() {
    try {
      const { open } = window.__TAURI__.dialog;
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder"
      });
      
      if (!selected) return false;
      
      this.rootFolder = selected;
      const files = await readDirectory(selected + '/');
      this.files = files;
      this.renderFileTree(files, this.container);
      
      // Dispatch event for folder opened
      document.dispatchEvent(new CustomEvent('folder-opened', {
        detail: {
          path: selected,
          files: files
        }
      }));
      
      return true;
    } catch (err) {
      console.error("Failed to open folder:", err);
      return false;
    }
  }
  
  // Render file tree in the UI
  renderFileTree(files, container) {
    container.innerHTML = '';
    
    if (!files || !files.length) {
      container.innerHTML = '<div class="empty-message">No files found</div>';
      return;
    }
    
    const ul = document.createElement('ul');
    ul.className = 'file-tree';
    
    files.forEach(file => {
      const li = this.createFileTreeItem(file);
      ul.appendChild(li);
    });
    
    container.appendChild(ul);
  }
  
  // Create a file tree item
  createFileTreeItem(file) {
    const li = document.createElement('li');
    li.className = 'file-item';
    li.dataset.id = file.id;
    li.dataset.path = file.path;
    
    const iconSpan = document.createElement('span');
    iconSpan.className = 'file-icon';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = file.name;
    
    if (file.kind === 'directory') {
      iconSpan.innerHTML = window.settings.icons.folder;
      li.classList.add('folder');
      
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        li.classList.toggle('expanded');
      });
    } else {
      iconSpan.innerHTML = this.getFileIcon(file.name);
      li.classList.add('file');
      
      li.addEventListener('click', () => {
        this.openFile(file.id);
      });
    }
    
    li.appendChild(iconSpan);
    li.appendChild(nameSpan);
    
    return li;
  }
  
  // Get file icon based on extension
  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    switch (ext) {
      case 'js':
        return window.settings.icons.javascript;
      case 'html':
        return window.settings.icons.html;
      case 'css':
        return window.settings.icons.css;
      case 'json':
        return window.settings.icons.json;
      case 'md':
        return window.settings.icons.markdown;
      default:
        return window.settings.icons.file;
    }
  }
  
  // Open a file
  async openFile(fileId) {
    try {
      const file = getFileObject(fileId);
      if (!file) return false;
      
      const content = await readFile(file.path);
      
      // Check if file is already open
      const existingFile = this.openedFiles.find(f => f.id === fileId);
      
      if (!existingFile) {
        // Add to opened files
        this.openedFiles.push({
          id: fileId,
          path: file.path,
          name: file.name,
          content
        });
      }
      
      // Set as selected file
      this.selectedFile = fileId;
      
      // Dispatch event for file opened
      document.dispatchEvent(new CustomEvent('file-opened', {
        detail: {
          id: fileId,
          path: file.path,
          name: file.name,
          content
        }
      }));
      
      return true;
    } catch (err) {
      console.error("Failed to open file:", err);
      return false;
    }
  }
  
  // Save a file
  async saveFile(fileId, content) {
    try {
      const file = getFileObject(fileId);
      if (!file) return false;
      
      const { writeTextFile } = window.__TAURI__.fs;
      await writeTextFile(file.path, content);
      
      // Update file in opened files
      const fileIndex = this.openedFiles.findIndex(f => f.id === fileId);
      if (fileIndex !== -1) {
        this.openedFiles[fileIndex].content = content;
      }
      
      return true;
    } catch (err) {
      console.error("Failed to save file:", err);
      return false;
    }
  }
  
  // Close a file
  closeFile(fileId) {
    const fileIndex = this.openedFiles.findIndex(f => f.id === fileId);
    
    if (fileIndex !== -1) {
      this.openedFiles.splice(fileIndex, 1);
      
      // If it was the selected file, select another one
      if (this.selectedFile === fileId) {
        this.selectedFile = this.openedFiles.length > 0 ? this.openedFiles[0].id : null;
        
        if (this.selectedFile) {
          const file = this.openedFiles.find(f => f.id === this.selectedFile);
          
          // Dispatch event for file opened
          document.dispatchEvent(new CustomEvent('file-opened', {
            detail: {
              id: file.id,
              path: file.path,
              name: file.name,
              content: file.content
            }
          }));
        } else {
          // Dispatch event for no file selected
          document.dispatchEvent(new CustomEvent('no-file-selected'));
        }
      }
      
      // Dispatch event for file closed
      document.dispatchEvent(new CustomEvent('file-closed', {
        detail: {
          id: fileId
        }
      }));
      
      return true;
    }
    
    return false;
  }
}

export default FileExplorer;