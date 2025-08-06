// file-explorer.js - Handles file explorer UI and functionality

import { readDirectory, getFileObject, readFile, writeFile, deleteFile, deleteDirectory, createDirectory, renameFile, copyFile, clipboardCopy, clipboardCut, clipboardPaste, clipboardGetStatus, clipboardClear } from './file-system.js';
import { Modal } from './modal.js';

class FileExplorer {
  constructor() {
    this.rootFolder = null;
    this.files = [];
    this.container = document.querySelector("#project-panel .sidebar-panel-content");
    this.openedFiles = [];
    this.selectedFile = null;
    this.selectedFiles = new Set(); // Track multiple selected files
    this.lastClickedFile = null; // For shift+click range selection
    this.hoveredFile = null; // Track currently hovered file for context menu
    this.watchInterval = null;
    this.lastRefreshTime = Date.now();
    this.lastRecursiveCount = 0;
    this.clipboardState = { path: null, isCut: false };
    this.expandedFolders = new Set(); // Track expanded folders
    
    // Bind methods
    this.openFolder = this.openFolder.bind(this);
    this.renderFileTree = this.renderFileTree.bind(this);
    this.createFileTreeItem = this.createFileTreeItem.bind(this);
    this.openFile = this.openFile.bind(this);
    this.saveFile = this.saveFile.bind(this);
    this.startWatching = this.startWatching.bind(this);
    this.stopWatching = this.stopWatching.bind(this);
  }
  
  // Open a specific folder by path
  async openFolderByPath(folderPath) {
    try {
      this.rootFolder = folderPath;
      const files = await readDirectory(folderPath + '/');
      this.files = files;
      this.renderFileTree(files, this.container);
      this.lastRecursiveCount = await this.getRecursiveFileCount(folderPath);
      
      // Start watching for file system changes
      this.stopWatching(); // Stop any existing watcher
      this.startWatching();
      
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
      
      // Load and validate expanded state
      this.loadExpandedState();
      await this.validateAndCleanupPaths();
      
      await this.renderFileTree(files, this.container);
      this.lastRecursiveCount = await this.getRecursiveFileCount(selected);
      
      // Start watching for file system changes
      this.stopWatching(); // Stop any existing watcher
      this.startWatching();
      
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
  async renderFileTree(files, container) {
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
    
    // Restore expanded state for folders
    await this.restoreExpandedState(container);
    
    // Add right-click handler for empty space to show root folder context menu
    container.addEventListener('contextmenu', (e) => {
      // Check if we're clicking on empty space (not on a file item)
      if (e.target === container || e.target === ul || e.target.className === 'empty-message') {
        e.preventDefault();
        if (this.rootFolder) {
          // Create a fake root folder object for context menu
          const rootFolderObject = {
            kind: 'folder',
            name: this.rootFolder.split('/').pop() || 'Root',
            path: this.rootFolder
          };
          this.showContextMenu(e, rootFolderObject);
        }
      }
    });
    
    // Add click handler for empty space to clear selection
    container.addEventListener('click', (e) => {
      // Check if we're clicking on empty space (not on a file item)
      if (e.target === container || e.target === ul || e.target.className === 'empty-message') {
        this.selectedFiles.clear();
        this.selectedFile = null;
        this.lastClickedFile = null;
        this.updateSelection();
      }
    });
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
        this.handleFileSelection(file.path, e);
        
        if (li.classList.contains('expanded')) {
          // Collapse folder
          li.classList.remove('expanded');
          this.expandedFolders.delete(file.path);
          const subList = li.querySelector('ul');
          if (subList) {
            subList.remove();
          }
        } else {
          // Expand folder
          li.classList.add('expanded');
          this.expandedFolders.add(file.path);
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
            this.expandedFolders.delete(file.path);
          }
        }
        
        // Save state after expansion/collapse
        this.saveExpandedState();
      });
      
      // Add mouse enter/leave for hover tracking
      itemContainer.addEventListener('mouseenter', () => {
        this.hoveredFile = file.path;
      });
      
      itemContainer.addEventListener('mouseleave', () => {
        this.hoveredFile = null;
      });
      
      // Add context menu for folders
      itemContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.hoveredFile = file.path;
        this.showContextMenu(e, file);
      });
    } else {
      iconSpan.innerHTML = this.getFileIcon(file.name);
      li.classList.add('file');
      
      itemContainer.addEventListener('click', (e) => {
        this.handleFileSelection(file.path, e);
        
        // Only open file if it's a single click without modifiers
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          this.openFile(file.id);
        }
      });
      
      // Add mouse enter/leave for hover tracking
      itemContainer.addEventListener('mouseenter', () => {
        this.hoveredFile = file.path;
      });
      
      itemContainer.addEventListener('mouseleave', () => {
        this.hoveredFile = null;
      });
      
      // Add context menu
      itemContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.hoveredFile = file.path;
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
      // Get file info before removal
      const fileToClose = this.openedFiles[fileIndex];
      
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
          id: fileId,
          path: fileToClose.path
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
    menu.style.zIndex = '1000';
    
    // Determine which files to operate on
    const targetFiles = this.getTargetFiles(file.path);
    const isMultipleFiles = targetFiles.length > 1;
    const hasFiles = targetFiles.some(f => !f.endsWith('/'));
    const hasFolders = targetFiles.some(f => f.endsWith('/') || this.isFolder(f));
    
    const menuItems = [];
    
    if (file.kind === 'file' && !isMultipleFiles) {
      // Single file context menu
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/'));
      
      menuItems.push(
        { label: 'Open', action: () => this.openFile(file.id) },
        { label: 'Open in Default App', action: () => this.openInDefaultApp(file.path) },
        { label: '---', action: null }, // Separator
        { label: 'New File', action: () => this.createNewFile(parentPath) },
        { label: 'New Folder', action: () => this.createNewFolder(parentPath) },
        { label: '---', action: null }, // Separator
        { label: 'Cut', action: () => this.cutFiles(targetFiles) },
        { label: 'Copy', action: () => this.copyFilesToClipboard(targetFiles) },
        { label: 'Paste', action: () => this.pasteFromClipboard(parentPath), disabled: !this.clipboardState.path && !this.clipboardState.paths },
        { label: '---', action: null }, // Separator
        { label: 'Duplicate', action: () => this.duplicateFile(file.path), disabled: isMultipleFiles },
        { label: 'Rename', action: () => this.renameFile(file.path), disabled: isMultipleFiles },
        { label: 'Copy Path', action: () => navigator.clipboard.writeText(file.path) },
        { label: 'Delete', action: () => this.deleteFiles(targetFiles) }
      );
    } else if (file.kind === 'folder' && !isMultipleFiles) {
      // Single folder context menu
      menuItems.push(
        { label: 'New File', action: () => this.createNewFile(file.path) },
        { label: 'New Folder', action: () => this.createNewFolder(file.path) },
        { label: '---', action: null }, // Separator
        { label: 'Cut', action: () => this.cutFiles(targetFiles) },
        { label: 'Copy', action: () => this.copyFilesToClipboard(targetFiles) },
        { label: 'Paste', action: () => this.pasteFromClipboard(file.path), disabled: !this.clipboardState.path && !this.clipboardState.paths },
        { label: '---', action: null }, // Separator
        { label: 'Duplicate', action: () => this.duplicateFolder(file.path), disabled: isMultipleFiles },
        { label: 'Rename', action: () => this.renameFile(file.path), disabled: isMultipleFiles },
        { label: '---', action: null }, // Separator
        { label: 'Open in Default App', action: () => this.openInDefaultApp(file.path) },
        { label: 'Copy Path', action: () => navigator.clipboard.writeText(file.path) },
        { label: 'Delete Folder', action: () => this.deleteFiles(targetFiles) }
      );
    } else {
      // Multiple files/folders context menu
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/'));
      
      menuItems.push(
        { label: `Cut ${targetFiles.length} items`, action: () => this.cutFiles(targetFiles) },
        { label: `Copy ${targetFiles.length} items`, action: () => this.copyFilesToClipboard(targetFiles) },
        { label: 'Paste', action: () => this.pasteFromClipboard(parentPath), disabled: !this.clipboardState.path && !this.clipboardState.paths },
        { label: '---', action: null }, // Separator
        { label: 'Copy Paths', action: () => navigator.clipboard.writeText(targetFiles.join('\n')) },
        { label: `Delete ${targetFiles.length} items`, action: () => this.deleteFiles(targetFiles) }
      );
      
      // Add new file/folder options based on context
      if (file.kind === 'folder') {
        menuItems.unshift(
          { label: 'New File', action: () => this.createNewFile(file.path) },
          { label: 'New Folder', action: () => this.createNewFolder(file.path) },
          { label: '---', action: null }
        );
      } else {
        menuItems.unshift(
          { label: 'New File', action: () => this.createNewFile(parentPath) },
          { label: 'New Folder', action: () => this.createNewFolder(parentPath) },
          { label: '---', action: null }
        );
      }
    }
    
    menuItems.forEach(item => {
      if (item.label === '---') {
        // Create separator
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        menu.appendChild(separator);
      } else {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        if (item.disabled) {
          menuItem.classList.add('disabled');
        }
        menuItem.textContent = item.label;
        menuItem.addEventListener('click', () => {
          if (item.action && !item.disabled) {
            item.action();
          }
          menu.remove();
        });
        menu.appendChild(menuItem);
      }
    });
    
    document.body.appendChild(menu);
    
    // Position menu with bounds checking
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = event.clientX;
    let top = event.clientY;
    
    // Check right boundary
    if (left + menuRect.width > viewportWidth) {
      left = viewportWidth - menuRect.width - 10; // 10px margin
    }
    
    // Check bottom boundary
    if (top + menuRect.height > viewportHeight) {
      top = viewportHeight - menuRect.height - 10; // 10px margin
    }
    
    // Ensure menu doesn't go off left/top edges
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    
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
    const fileName = await Modal.prompt('Create New File', 'Enter file name:');
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
      await Modal.alert("Error", "Failed to create file: " + err);
    }
  }
  
  async createNewFolder(parentPath) {
    const folderName = await Modal.prompt('Create New Folder', 'Enter folder name:');
    if (!folderName) return;
    
    const folderPath = `${parentPath}/${folderName}`;
    try {
      await createDirectory(folderPath);
      
      // Refresh the parent folder
      this.refreshFolder(parentPath);
    } catch (err) {
      console.error("Failed to create folder:", err);
      await Modal.alert("Error", "Failed to create folder: " + err);
    }
  }
  
  async deleteFiles(filePaths) {
    if (filePaths.length === 1) {
      return this.deleteSingleItem(filePaths[0]);
    }
    
    // Multiple files deletion
    const confirmed = await Modal.confirm('Delete Items', `Are you sure you want to delete ${filePaths.length} items?\n\nThis action cannot be undone.`);
    if (!confirmed) return;
    
    try {
      for (const filePath of filePaths) {
        if (this.isFolder(filePath)) {
          await deleteDirectory(filePath);
        } else {
          await deleteFile(filePath);
        }
        
        // Close the file tab if it was open
        const currentTab = document.querySelector(`[data-file-path="${filePath}"]`);
        if (currentTab) {
          window.closeTab(filePath);
        }
        
        // Close any open files that were inside deleted folders
        if (this.isFolder(filePath)) {
          document.querySelectorAll('.tab[data-file-path]').forEach(tab => {
            const tabPath = tab.getAttribute('data-file-path');
            if (tabPath.startsWith(filePath + '/')) {
              window.closeTab(tabPath);
            }
          });
        }
      }
      
      // Clear selection
      this.selectedFiles.clear();
      this.updateSelection();
      
      // Refresh the folder
      this.refreshFolder(this.rootFolder);
    } catch (err) {
      console.error("Failed to delete files:", err);
      await Modal.alert("Error", "Failed to delete files: " + err);
    }
  }
  
  async deleteSingleItem(filePath) {
    const fileName = filePath.split('/').pop();
    const isFolder = this.isFolder(filePath);
    const title = isFolder ? 'Delete Folder' : 'Delete File';
    const message = isFolder ? 
      `Are you sure you want to delete "${fileName}" and all its contents?\n\nThis action cannot be undone.` :
      `Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`;
    
    const confirmed = await Modal.confirm(title, message);
    if (!confirmed) return;
    
    try {
      if (isFolder) {
        await deleteDirectory(filePath);
      } else {
        await deleteFile(filePath);
      }
      
      // Refresh the parent folder
      const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));
      this.refreshFolder(parentPath);
      
      // Close the file tab if it was open
      const currentTab = document.querySelector(`[data-file-path="${filePath}"]`);
      if (currentTab) {
        window.closeTab(filePath);
      }
      
      // Close any open files that were inside deleted folders
      if (isFolder) {
        document.querySelectorAll('.tab[data-file-path]').forEach(tab => {
          const tabPath = tab.getAttribute('data-file-path');
          if (tabPath.startsWith(filePath + '/')) {
            window.closeTab(tabPath);
          }
        });
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
      await Modal.alert("Error", "Failed to delete item: " + err);
    }
  }
  
  // Legacy methods for backward compatibility
  async deleteFile(filePath) {
    return this.deleteFiles([filePath]);
  }
  
  async deleteFolder(folderPath) {
    return this.deleteFiles([folderPath]);
  }
  
  async renameFile(filePath) {
    const currentName = filePath.split('/').pop();
    const newName = await Modal.prompt('Rename', 'Enter new name:', currentName);
    if (!newName || newName === currentName) return;
    
    const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));
    const newPath = `${parentPath}/${newName}`;
    
    try {
      await renameFile(filePath, newPath);
      
      // Refresh the parent folder
      this.refreshFolder(parentPath);
      
      // Update any open tabs if this was a file
      if (!filePath.endsWith('/')) {
        const currentTab = document.querySelector(`[data-file-path="${filePath}"]`);
        if (currentTab) {
          // Close old tab and potentially reopen with new path
          window.closeTab(filePath);
          // The file explorer refresh will handle showing the new file
        }
      }
    } catch (err) {
      console.error("Failed to rename file:", err);
      await Modal.alert("Error", "Failed to rename: " + err);
    }
  }
  
  async duplicateFile(filePath) {
    const fileName = filePath.split('/').pop();
    const nameWithoutExt = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
    const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
    const defaultName = `${nameWithoutExt} copy${extension}`;
    
    const newName = await Modal.prompt('Duplicate File', 'Enter new file name:', defaultName);
    if (!newName) return;
    
    const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));
    const newPath = `${parentPath}/${newName}`;
    
    try {
      await copyFile(filePath, newPath);
      
      // Refresh the parent folder
      this.refreshFolder(parentPath);
    } catch (err) {
      console.error("Failed to duplicate file:", err);
      await Modal.alert("Error", "Failed to duplicate file: " + err);
    }
  }
  
  async duplicateFolder(folderPath) {
    const folderName = folderPath.split('/').pop();
    const defaultName = `${folderName} copy`;
    
    const newName = await Modal.prompt('Duplicate Folder', 'Enter new folder name:', defaultName);
    if (!newName) return;
    
    const parentPath = folderPath.substring(0, folderPath.lastIndexOf('/'));
    const newPath = `${parentPath}/${newName}`;
    
    try {
      // First create the new folder
      await createDirectory(newPath);
      
      // Then copy all contents recursively (we'll need to implement this)
      await this.copyFolderContents(folderPath, newPath);
      
      // Refresh the parent folder
      this.refreshFolder(parentPath);
    } catch (err) {
      console.error("Failed to duplicate folder:", err);
      await Modal.alert("Error", "Failed to duplicate folder: " + err);
    }
  }
  
  async copyFolderContents(sourcePath, destPath) {
    try {
      const files = await readDirectory(sourcePath + '/');
      
      for (const file of files) {
        const sourceFilePath = file.path;
        const fileName = file.name;
        const destFilePath = `${destPath}/${fileName}`;
        
        if (file.kind === 'file') {
          await copyFile(sourceFilePath, destFilePath);
        } else if (file.kind === 'folder') {
          await createDirectory(destFilePath);
          await this.copyFolderContents(sourceFilePath, destFilePath);
        }
      }
    } catch (err) {
      throw new Error(`Failed to copy folder contents: ${err}`);
    }
  }
  
  refreshFolder(folderPath) {
    // Refresh the file tree - simplified implementation
    if (folderPath === this.rootFolder) {
      this.openFolderByPath(this.rootFolder);
    } else {
      // For subfolders, we need to refresh the entire tree to catch all changes
      this.openFolderByPath(this.rootFolder);
    }
    // Update clipboard status and visual feedback
    this.updateClipboardStatus();
  }
  
  startWatching() {
    if (this.watchInterval || !this.rootFolder) return;
    
    // Poll for changes every 2 seconds
    this.watchInterval = setInterval(async () => {
      try {
        // Get current files and compare with cached version
        const currentFiles = await readDirectory(this.rootFolder + '/');
        
        // Check if there are any changes in the root directory
        if (this.hasFileSystemChanged(currentFiles)) {
          console.log('File system changes detected, refreshing...');
          this.files = currentFiles;
          this.renderFileTree(currentFiles, this.container);
          this.lastRefreshTime = Date.now();
        } else {
          // Even if root hasn't changed, check if any subfolder has changed
          // by comparing the recursive file count and structure
          const currentRecursiveCount = await this.getRecursiveFileCount(this.rootFolder);
          if (this.lastRecursiveCount !== currentRecursiveCount) {
            console.log('Subfolder changes detected, refreshing...');
            this.files = currentFiles;
            this.renderFileTree(currentFiles, this.container);
            this.lastRecursiveCount = currentRecursiveCount;
            this.lastRefreshTime = Date.now();
          }
        }
      } catch (err) {
        console.error('Error watching file system:', err);
      }
    }, 2000);
  }
  
  stopWatching() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }
  
  async getRecursiveFileCount(rootPath) {
    let count = 0;
    
    async function scanDirectory(dirPath) {
      try {
        const files = await readDirectory(dirPath + '/');
        count += files.length;
        
        for (const file of files) {
          // If it's a folder, recursively scan it
          if (file.kind === 'folder') {
            await scanDirectory(file.path);
          }
        }
      } catch (err) {
        console.error(`Error scanning directory ${dirPath}:`, err);
      }
    }
    
    await scanDirectory(rootPath);
    return count;
  }
  
  hasFileSystemChanged(newFiles) {
    if (!this.files || this.files.length !== newFiles.length) {
      return true;
    }
    
    // Create sets of file paths for comparison
    const oldPaths = new Set(this.files.map(f => f.path));
    const newPaths = new Set(newFiles.map(f => f.path));
    
    // Check if any paths are different
    for (const path of newPaths) {
      if (!oldPaths.has(path)) return true;
    }
    for (const path of oldPaths) {
      if (!newPaths.has(path)) return true;
    }
    
    return false;
  }
  
  // Determine which files to operate on (hovered or selected)
  getTargetFiles(hoveredPath) {
    // If multiple files are selected and the hovered file is one of them, use all selected
    if (this.selectedFiles.size > 1 && this.selectedFiles.has(hoveredPath)) {
      return Array.from(this.selectedFiles);
    }
    // If one file is selected and it's the hovered file, use it
    if (this.selectedFiles.size === 1 && this.selectedFiles.has(hoveredPath)) {
      return [hoveredPath];
    }
    // Otherwise, use the hovered file
    return [hoveredPath];
  }
  
  // Helper to check if a path is a folder
  isFolder(path) {
    const fileItem = document.querySelector(`[data-path="${path}"]`);
    return fileItem && fileItem.classList.contains('folder');
  }
  
  // Helper to check if a file exists
  async fileExists(filePath) {
    try {
      // Try to read the file/directory to check if it exists
      await readFile(filePath);
      return true;
    } catch {
      try {
        // If reading as file fails, try as directory
        await readDirectory(filePath + '/');
        return true;
      } catch {
        return false;
      }
    }
  }
  
  // Clipboard operations - updated for multiple files
  async cutFiles(filePaths) {
    try {
      // Store multiple files in our internal clipboard state
      this.clipboardState = { 
        paths: [...filePaths], 
        isCut: true,
        path: filePaths[0] // Keep first path for backward compatibility
      };
      
      // Also set the system clipboard with the first file for external paste compatibility
      await clipboardCut(filePaths[0]);
      
      if (filePaths.length === 1) {
        console.log(`Cut "${filePaths[0].split('/').pop()}" to clipboard`);
      } else {
        console.log(`Cut ${filePaths.length} items to clipboard`);
      }
      
      this.updateFileTreeDisplay();
    } catch (err) {
      console.error("Failed to cut files:", err);
      await Modal.alert("Error", "Failed to cut files: " + err.message);
    }
  }
  
  async copyFilesToClipboard(filePaths) {
    try {
      // Store multiple files in our internal clipboard state
      this.clipboardState = { 
        paths: [...filePaths], 
        isCut: false,
        path: filePaths[0] // Keep first path for backward compatibility
      };
      
      // Also set the system clipboard with the first file for external paste compatibility
      await clipboardCopy(filePaths[0]);
      
      if (filePaths.length === 1) {
        console.log(`Copied "${filePaths[0].split('/').pop()}" to clipboard`);
      } else {
        console.log(`Copied ${filePaths.length} items to clipboard`);
      }
      
      this.updateFileTreeDisplay();
    } catch (err) {
      console.error("Failed to copy files:", err);
      await Modal.alert("Error", "Failed to copy files: " + err.message);
    }
  }
  
  // Legacy methods for backward compatibility
  async cutFile(filePath) {
    return this.cutFiles([filePath]);
  }
  
  async copyFileToClipboard(filePath) {
    return this.copyFilesToClipboard([filePath]);
  }
  
  async pasteFromClipboard(targetDir) {
    if (!this.clipboardState.path && !this.clipboardState.paths) {
      await Modal.alert("Error", "Clipboard is empty");
      return;
    }
    
    try {
      const filesToPaste = this.clipboardState.paths || [this.clipboardState.path];
      
      if (filesToPaste.length === 1) {
        // Single file - use the existing system paste
        const result = await clipboardPaste(targetDir);
        console.log('Paste result:', result);
      } else {
        // Multiple files - handle each one manually
        for (const filePath of filesToPaste) {
          const fileName = filePath.split('/').pop();
          const targetPath = `${targetDir}/${fileName}`;
          
          // Check if target already exists and generate a unique name if needed
          let finalTargetPath = targetPath;
          let counter = 1;
          
          while (await this.fileExists(finalTargetPath)) {
            const pathParts = filePath.split('/');
            const originalName = pathParts[pathParts.length - 1];
            
            let nameWithoutExt, extension;
            if (this.isFolder(filePath)) {
              nameWithoutExt = originalName;
              extension = '';
            } else {
              const lastDotIndex = originalName.lastIndexOf('.');
              if (lastDotIndex > 0) {
                nameWithoutExt = originalName.substring(0, lastDotIndex);
                extension = originalName.substring(lastDotIndex);
              } else {
                nameWithoutExt = originalName;
                extension = '';
              }
            }
            
            const newName = `${nameWithoutExt} (${counter})${extension}`;
            finalTargetPath = `${targetDir}/${newName}`;
            counter++;
            
            if (counter > 100) {
              throw new Error("Too many name conflicts");
            }
          }
          
          if (this.clipboardState.isCut) {
            // Move operation
            await renameFile(filePath, finalTargetPath);
          } else {
            // Copy operation
            if (this.isFolder(filePath)) {
              await createDirectory(finalTargetPath);
              await this.copyFolderContents(filePath, finalTargetPath);
            } else {
              await copyFile(filePath, finalTargetPath);
            }
          }
        }
        
        console.log(`Pasted ${filesToPaste.length} items`);
      }
      
      // If it was a cut operation, clear clipboard state
      if (this.clipboardState.isCut) {
        this.clipboardState = { path: null, paths: null, isCut: false };
      }
      
      // Refresh the target directory
      this.refreshFolder(targetDir);
      this.updateFileTreeDisplay();
      
    } catch (err) {
      console.error("Failed to paste:", err);
      await Modal.alert("Error", "Failed to paste: " + err.message);
    }
  }
  
  async updateClipboardStatus() {
    try {
      const status = await clipboardGetStatus();
      if (status) {
        // Keep our internal multiple file state if it exists, otherwise use system clipboard
        if (!this.clipboardState.paths) {
          this.clipboardState = { path: status[0], isCut: status[1] };
        }
      } else {
        this.clipboardState = { path: null, paths: null, isCut: false };
      }
    } catch (err) {
      console.error("Failed to get clipboard status:", err);
    }
  }
  
  updateFileTreeDisplay() {
    // Update visual feedback for cut/copied files
    document.querySelectorAll('.file-item, .folder-item').forEach(item => {
      const itemPath = item.getAttribute('data-path');
      item.classList.remove('clipboard-cut', 'clipboard-copied');
      
      // Check if this item is in our clipboard (single or multiple files)
      const isInClipboard = this.clipboardState.paths ? 
        this.clipboardState.paths.includes(itemPath) : 
        this.clipboardState.path === itemPath;
      
      if (isInClipboard) {
        if (this.clipboardState.isCut) {
          item.classList.add('clipboard-cut');
        } else {
          item.classList.add('clipboard-copied');
        }
      }
    });
  }
  
  handleFileSelection(filePath, event) {
    if (event.shiftKey && this.lastClickedFile) {
      // Shift+click for range selection
      this.selectRange(this.lastClickedFile, filePath);
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+click for multi-selection toggle
      if (this.selectedFiles.has(filePath)) {
        this.selectedFiles.delete(filePath);
      } else {
        this.selectedFiles.add(filePath);
      }
    } else {
      // Regular click - single selection
      this.selectedFiles.clear();
      this.selectedFiles.add(filePath);
      this.selectedFile = filePath;
    }
    
    this.lastClickedFile = filePath;
    this.updateSelection();
  }
  
  selectRange(startPath, endPath) {
    // Get all file items in the tree
    const allItems = Array.from(document.querySelectorAll('.file-item[data-path]'));
    const startIndex = allItems.findIndex(item => item.dataset.path === startPath);
    const endIndex = allItems.findIndex(item => item.dataset.path === endPath);
    
    if (startIndex === -1 || endIndex === -1) return;
    
    // Clear current selection
    this.selectedFiles.clear();
    
    // Select range
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    for (let i = minIndex; i <= maxIndex; i++) {
      const itemPath = allItems[i].dataset.path;
      this.selectedFiles.add(itemPath);
    }
  }
  
  updateSelection() {
    // Update visual feedback for selected files
    document.querySelectorAll('.file-item').forEach(item => {
      item.classList.remove('selected', 'multi-selected');
    });
    
    const isMultiSelection = this.selectedFiles.size > 1;
    
    this.selectedFiles.forEach(filePath => {
      const selectedItem = document.querySelector(`[data-path="${filePath}"]`);
      if (selectedItem) {
        selectedItem.classList.add('selected');
        if (isMultiSelection) {
          selectedItem.classList.add('multi-selected');
        }
      }
    });
    
    // Update selectedFile for backward compatibility
    if (this.selectedFiles.size === 1) {
      this.selectedFile = Array.from(this.selectedFiles)[0];
    } else if (this.selectedFiles.size === 0) {
      this.selectedFile = null;
    } else {
      // Multiple files selected, keep last clicked as primary
      this.selectedFile = this.lastClickedFile;
    }
  }
  
  // Persistence methods
  saveExpandedState() {
    if (!window.settings) return;
    
    // Save expanded folders
    window.settings.fileExplorer.expandedFolders = Array.from(this.expandedFolders);
    
    // Save open files (from main.js openTabs)
    if (window.openTabs) {
      window.settings.fileExplorer.openFiles = Array.from(window.openTabs);
    }
    
    // Trigger settings save
    if (window.saveSettings) {
      window.saveSettings();
    }
  }
  
  loadExpandedState() {
    if (!window.settings?.fileExplorer) return;
    
    // Load expanded folders
    const savedExpandedFolders = window.settings.fileExplorer.expandedFolders || [];
    this.expandedFolders = new Set(savedExpandedFolders);
    
    // Load open files
    const savedOpenFiles = window.settings.fileExplorer.openFiles || [];
    if (window.openTabs) {
      // Clear current tabs and add saved ones
      window.openTabs.clear();
      savedOpenFiles.forEach(filePath => {
        window.openTabs.add(filePath);
      });
    }
  }
  
  async validateAndCleanupPaths() {
    if (!window.settings?.fileExplorer) return;
    
    const { fileExists } = await import('./file-system.js');
    
    // Clean up expanded folders
    const validExpandedFolders = [];
    for (const folderPath of this.expandedFolders) {
      try {
        const exists = await fileExists(folderPath);
        if (exists) {
          validExpandedFolders.push(folderPath);
        }
      } catch (err) {
        console.log(`Removing invalid expanded folder: ${folderPath}`);
      }
    }
    this.expandedFolders = new Set(validExpandedFolders);
    
    // Clean up open files
    if (window.openTabs) {
      const validOpenFiles = [];
      for (const filePath of window.openTabs) {
        try {
          const exists = await fileExists(filePath);
          if (exists) {
            validOpenFiles.push(filePath);
          } else {
            console.log(`Removing invalid open file: ${filePath}`);
          }
        } catch (err) {
          console.log(`Removing invalid open file: ${filePath}`);
        }
      }
      
      // Update openTabs
      window.openTabs.clear();
      validOpenFiles.forEach(filePath => window.openTabs.add(filePath));
      
      // Update tabs UI
      if (window.updateTabs) {
        window.updateTabs();
      }
    }
    
    // Save cleaned up state
    this.saveExpandedState();
  }
  
  async restoreExpandedState(container) {
    if (!this.expandedFolders || this.expandedFolders.size === 0) return;
    
    // Find all folder items that should be expanded
    for (const folderPath of this.expandedFolders) {
      const folderItem = container.querySelector(`[data-path="${folderPath}"]`);
      if (folderItem && !folderItem.classList.contains('expanded')) {
        // Simulate a click to expand the folder
        const itemContainer = folderItem.querySelector('.file-item-content');
        if (itemContainer) {
          // Trigger the click event
          const clickEvent = new Event('click', { bubbles: true });
          itemContainer.dispatchEvent(clickEvent);
        }
      }
    }
  }
}

export default FileExplorer;