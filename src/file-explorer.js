// file-explorer.js - Handles file explorer UI and functionality

import { readDirectory, getFileObject, readFile, writeFile } from './file-system.js';

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
  
  // Open a specific folder by path
  async openFolderByPath(folderPath) {
    try {
      this.rootFolder = folderPath;
      const files = await readDirectory(folderPath + '/');
      this.files = files;
      this.renderFileTree(files, this.container);
      
      // Dispatch event for folder opened
      document.dispatchEvent(new CustomEvent('folder-opened', {
        detail: {
          path: folderPath,
          files: files
        }
      }));
      
      return true;
    } catch (err) {
      console.error("Failed to open folder:", err);
      return false;
    }
  }

  // Open a folder and load its contents
  async openFolder() {
    try {
      const selected = await window.__TAURI__.dialog.open({
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
    
    // Create a container for the file/folder info
    const itemContainer = document.createElement('div');
    itemContainer.className = 'file-item-content';
    
    const iconSpan = document.createElement('span');
    iconSpan.className = 'file-icon';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = file.name;
    
    if (file.kind === 'folder') {
      iconSpan.innerHTML = window.settings.icons.folder;
      li.classList.add('folder');
      
      itemContainer.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        if (li.classList.contains('expanded')) {
          // Collapse folder
          li.classList.remove('expanded');
          const subList = li.querySelector('ul');
          if (subList) {
            subList.remove();
          }
        } else {
          // Expand folder
          li.classList.add('expanded');
          try {
            const folderPath = file.path.endsWith('/') ? file.path : file.path + '/';
            const subFiles = await readDirectory(folderPath);
            
            if (subFiles && subFiles.length > 0) {
              const subUl = document.createElement('ul');
              subUl.className = 'file-tree';
              
              subFiles.forEach(subFile => {
                const subLi = this.createFileTreeItem(subFile);
                subUl.appendChild(subLi);
              });
              
              li.appendChild(subUl);
            }
          } catch (error) {
            console.error('Failed to expand folder:', error);
            li.classList.remove('expanded');
          }
        }
      });
    } else {
      iconSpan.innerHTML = this.getFileIcon(file.name);
      li.classList.add('file');
      
      itemContainer.addEventListener('click', () => {
        this.openFile(file.id);
      });
      
      // Add context menu
      itemContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, file);
      });
    }
    
    itemContainer.appendChild(iconSpan);
    itemContainer.appendChild(nameSpan);
    li.appendChild(itemContainer);
    
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
  
  // Open a file by its path (for command palette)
  async openFileByPath(filePath) {
    try {
      // Check if file is already open
      const existingFile = this.openedFiles.find(f => f.path === filePath);
      if (existingFile) {
        this.selectedFile = existingFile.id;
        
        // Dispatch event for file opened
        document.dispatchEvent(new CustomEvent('file-opened', {
          detail: {
            id: existingFile.id,
            path: existingFile.path,
            name: existingFile.name,
            content: existingFile.content
          }
        }));
        
        return true;
      }
      
      // Read file content
      const content = await readFile(filePath);
      
      // Generate ID and create file object
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'untitled';
      
      // Add to opened files
      const openedFile = {
        id: fileId,
        path: filePath,
        name: fileName,
        content: content
      };
      
      this.openedFiles.push(openedFile);
      this.selectedFile = fileId;
      
      // Dispatch event for file opened
      document.dispatchEvent(new CustomEvent('file-opened', {
        detail: {
          id: fileId,
          path: filePath,
          name: fileName,
          content: content
        }
      }));
      
      return true;
    } catch (err) {
      console.error("Failed to open file by path:", err);
      return false;
    }
  }
  
  // Save a file
  async saveFile(fileId, content) {
    try {
      const file = getFileObject(fileId);
      if (!file) return false;
      
      // Use our custom writeFile function that uses core.invoke
      await writeFile(file.path, content);
      
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
  
  // Show context menu
  showContextMenu(event, file) {
    // Remove existing context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.style.zIndex = '1000';
    
    const menuItems = [];
    
    if (file.kind === 'file') {
      menuItems.push(
        { label: 'Open', action: () => this.openFile(file.id) },
        { label: 'Open in Default App', action: () => this.openInDefaultApp(file.path) },
        { label: 'Copy Path', action: () => navigator.clipboard.writeText(file.path) },
        { label: 'Delete', action: () => this.deleteFile(file.path) }
      );
    } else {
      menuItems.push(
        { label: 'New File', action: () => this.createNewFile(file.path) },
        { label: 'New Folder', action: () => this.createNewFolder(file.path) },
        { label: 'Open in Default App', action: () => this.openInDefaultApp(file.path) },
        { label: 'Copy Path', action: () => navigator.clipboard.writeText(file.path) },
        { label: 'Delete Folder', action: () => this.deleteFolder(file.path) }
      );
    }
    
    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'context-menu-item';
      menuItem.textContent = item.label;
      menuItem.addEventListener('click', () => {
        item.action();
        menu.remove();
      });
      menu.appendChild(menuItem);
    });
    
    document.body.appendChild(menu);
    
    // Remove menu when clicking elsewhere
    const removeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', removeMenu);
    }, 0);
  }
  
  async openInDefaultApp(path) {
    try {
      await window.__TAURI__.plugin.opener.open(path);
    } catch (err) {
      console.error("Failed to open in default app:", err);
    }
  }
  
  async createNewFile(parentPath) {
    const fileName = prompt('Enter file name:');
    if (!fileName) return;
    
    const filePath = `${parentPath}/${fileName}`;
    try {
      await window.__TAURI__.core.invoke("write_text_file", { 
        filePath, 
        content: "" 
      });
      
      // Refresh the folder
      this.refreshFolder(parentPath);
    } catch (err) {
      console.error("Failed to create file:", err);
      alert("Failed to create file: " + err);
    }
  }
  
  async createNewFolder(parentPath) {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;
    
    const folderPath = `${parentPath}/${folderName}`;
    try {
      // Create folder by creating a temporary file and then deleting it
      const tempFile = `${folderPath}/.gitkeep`;
      await window.__TAURI__.core.invoke("write_text_file", { 
        filePath: tempFile, 
        content: "" 
      });
      
      // Refresh the parent folder
      this.refreshFolder(parentPath);
    } catch (err) {
      console.error("Failed to create folder:", err);
      alert("Failed to create folder: " + err);
    }
  }
  
  async deleteFile(filePath) {
    if (!confirm(`Are you sure you want to delete this file?\n${filePath}`)) {
      return;
    }
    
    try {
      // Note: Tauri doesn't have a built-in delete function, we'd need to add one
      console.log("Delete file not implemented yet:", filePath);
      alert("Delete functionality needs to be implemented in the Rust backend");
    } catch (err) {
      console.error("Failed to delete file:", err);
    }
  }
  
  async deleteFolder(folderPath) {
    if (!confirm(`Are you sure you want to delete this folder?\n${folderPath}`)) {
      return;
    }
    
    try {
      // Note: Tauri doesn't have a built-in delete function, we'd need to add one
      console.log("Delete folder not implemented yet:", folderPath);
      alert("Delete functionality needs to be implemented in the Rust backend");
    } catch (err) {
      console.error("Failed to delete folder:", err);
    }
  }
  
  refreshFolder(folderPath) {
    // Refresh the file tree - simplified implementation
    if (folderPath === this.rootFolder) {
      this.openFolderByPath(this.rootFolder);
    }
  }
}

export default FileExplorer;