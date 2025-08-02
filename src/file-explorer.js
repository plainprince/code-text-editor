// file-explorer.js
// Handles file system operations and UI for the file explorer

const { readDir, readTextFile, writeTextFile, createDir, removeFile } = window.__TAURI__.fs;
const { open, save, message } = window.__TAURI__.dialog;

class FileExplorer {
  constructor() {
    this.rootFolder = null;
    this.fileTree = [];
    this.selectedFile = null;
    this.openedFiles = [];
    this.container = document.querySelector("#project-panel .sidebar-panel-content");
    
    // Bind methods
    this.openFolder = this.openFolder.bind(this);
    this.renderFileTree = this.renderFileTree.bind(this);
    this.createFileTreeItem = this.createFileTreeItem.bind(this);
    this.openFile = this.openFile.bind(this);
    this.saveFile = this.saveFile.bind(this);
    this.createNewFile = this.createNewFile.bind(this);
    this.createNewFolder = this.createNewFolder.bind(this);
    this.deleteItem = this.deleteItem.bind(this);
    this.refreshFileTree = this.refreshFileTree.bind(this);
  }
  
  // Open a folder and load its contents
  async openFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder"
      });
      
      if (selected) {
        this.rootFolder = selected;
        await this.refreshFileTree();
        return true;
      }
    } catch (err) {
      console.error("Failed to open folder:", err);
      return false;
    }
    
    return false;
  }
  
  // Refresh the file tree
  async refreshFileTree() {
    if (!this.rootFolder) return;
    
    try {
      const entries = await readDir(this.rootFolder, { recursive: true });
      this.fileTree = entries;
      this.renderFileTree(entries, this.container);
    } catch (err) {
      console.error("Failed to refresh file tree:", err);
    }
  }
  
  // Render the file tree in the UI
  renderFileTree(entries, container) {
    // Clear container
    container.innerHTML = '';
    
    // Create root list
    const ul = document.createElement('ul');
    ul.className = 'file-tree';
    
    // Sort entries: directories first, then files
    entries.sort((a, b) => {
      if (a.children && !b.children) return -1;
      if (!a.children && b.children) return 1;
      return a.name.localeCompare(b.name);
    });
    
    // Add entries to list
    entries.forEach(entry => {
      const li = this.createFileTreeItem(entry);
      ul.appendChild(li);
    });
    
    container.appendChild(ul);
  }
  
  // Create a file tree item (recursive)
  createFileTreeItem(entry) {
    const li = document.createElement('li');
    
    // Create item with icon
    const item = document.createElement('div');
    item.className = 'file-item';
    
    // Add icon based on file type
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    
    if (entry.children) {
      // It's a directory
      icon.textContent = window.settings.icons.folder;
      item.classList.add('folder');
      
      // Add click handler to toggle folder
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        li.classList.toggle('expanded');
      });
      
      // Add context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, entry, 'folder');
      });
      
      // Add children
      if (entry.children.length > 0) {
        const childUl = document.createElement('ul');
        childUl.className = 'file-tree';
        
        // Recursively render children
        entry.children.forEach(child => {
          const childLi = this.createFileTreeItem(child);
          childUl.appendChild(childLi);
        });
        
        li.appendChild(childUl);
      }
    } else {
      // It's a file
      icon.textContent = this.getFileIcon(entry.name);
      item.classList.add('file');
      
      // Add click handler to open file
      item.addEventListener('click', () => {
        this.openFile(entry.path);
      });
      
      // Add context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, entry, 'file');
      });
    }
    
    // Add name
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = entry.name;
    
    item.appendChild(icon);
    item.appendChild(name);
    li.appendChild(item);
    
    return li;
  }
  
  // Get icon for file based on extension
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
  
  // Open a file and load its contents
  async openFile(path) {
    try {
      const content = await readTextFile(path);
      const filename = path.split('/').pop();
      
      // Check if file is already open
      const existingFile = this.openedFiles.find(file => file.path === path);
      
      if (!existingFile) {
        // Add to opened files
        this.openedFiles.push({
          path,
          filename,
          content
        });
      }
      
      // Set as selected file
      this.selectedFile = path;
      
      // Dispatch event for file opened
      const event = new CustomEvent('file-opened', {
        detail: {
          path,
          filename,
          content
        }
      });
      document.dispatchEvent(event);
      
      return true;
    } catch (err) {
      console.error("Failed to open file:", err);
      return false;
    }
  }
  
  // Save a file
  async saveFile(path, content) {
    try {
      await writeTextFile(path, content);
      
      // Update file in opened files
      const fileIndex = this.openedFiles.findIndex(file => file.path === path);
      if (fileIndex !== -1) {
        this.openedFiles[fileIndex].content = content;
      }
      
      return true;
    } catch (err) {
      console.error("Failed to save file:", err);
      return false;
    }
  }
  
  // Create a new file
  async createNewFile(folderPath) {
    try {
      const result = await message("Enter file name:", { title: "New File", type: "info" });
      
      if (result) {
        const filePath = `${folderPath}/${result}`;
        await writeTextFile(filePath, '');
        await this.refreshFileTree();
        return filePath;
      }
    } catch (err) {
      console.error("Failed to create file:", err);
    }
    
    return null;
  }
  
  // Create a new folder
  async createNewFolder(folderPath) {
    try {
      const result = await message("Enter folder name:", { title: "New Folder", type: "info" });
      
      if (result) {
        const newFolderPath = `${folderPath}/${result}`;
        await createDir(newFolderPath, { recursive: true });
        await this.refreshFileTree();
        return newFolderPath;
      }
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
    
    return null;
  }
  
  // Delete a file or folder
  async deleteItem(path) {
    try {
      const confirmed = await message("Are you sure you want to delete this item?", {
        title: "Delete",
        type: "warning",
        okLabel: "Yes",
        cancelLabel: "No"
      });
      
      if (confirmed) {
        await removeFile(path);
        
        // Remove from opened files if it's open
        const fileIndex = this.openedFiles.findIndex(file => file.path === path);
        if (fileIndex !== -1) {
          this.openedFiles.splice(fileIndex, 1);
          
          // If it was the selected file, select another one
          if (this.selectedFile === path) {
            this.selectedFile = this.openedFiles.length > 0 ? this.openedFiles[0].path : null;
            
            if (this.selectedFile) {
              const file = this.openedFiles.find(file => file.path === this.selectedFile);
              
              // Dispatch event for file opened
              const event = new CustomEvent('file-opened', {
                detail: {
                  path: file.path,
                  filename: file.filename,
                  content: file.content
                }
              });
              document.dispatchEvent(event);
            } else {
              // Dispatch event for no file selected
              const event = new CustomEvent('no-file-selected');
              document.dispatchEvent(event);
            }
          }
        }
        
        await this.refreshFileTree();
        return true;
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
    
    return false;
  }
  
  // Show context menu for file or folder
  showContextMenu(event, entry, type) {
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.style.backgroundColor = 'var(--panel-bg)';
    menu.style.border = '1px solid var(--panel-border)';
    menu.style.borderRadius = '3px';
    menu.style.padding = '5px 0';
    menu.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    menu.style.zIndex = '1000';
    
    // Add menu items
    if (type === 'folder') {
      // New file
      const newFile = document.createElement('div');
      newFile.className = 'context-menu-item';
      newFile.textContent = 'New File';
      newFile.style.padding = '5px 10px';
      newFile.style.cursor = 'pointer';
      newFile.addEventListener('mouseenter', () => {
        newFile.style.backgroundColor = 'var(--hover-bg)';
      });
      newFile.addEventListener('mouseleave', () => {
        newFile.style.backgroundColor = '';
      });
      newFile.addEventListener('click', () => {
        this.createNewFile(entry.path);
        document.body.removeChild(menu);
      });
      menu.appendChild(newFile);
      
      // New folder
      const newFolder = document.createElement('div');
      newFolder.className = 'context-menu-item';
      newFolder.textContent = 'New Folder';
      newFolder.style.padding = '5px 10px';
      newFolder.style.cursor = 'pointer';
      newFolder.addEventListener('mouseenter', () => {
        newFolder.style.backgroundColor = 'var(--hover-bg)';
      });
      newFolder.addEventListener('mouseleave', () => {
        newFolder.style.backgroundColor = '';
      });
      newFolder.addEventListener('click', () => {
        this.createNewFolder(entry.path);
        document.body.removeChild(menu);
      });
      menu.appendChild(newFolder);
      
      // Separator
      const separator = document.createElement('div');
      separator.style.height = '1px';
      separator.style.backgroundColor = 'var(--panel-border)';
      separator.style.margin = '5px 0';
      menu.appendChild(separator);
    }
    
    // Delete
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item';
    deleteItem.textContent = 'Delete';
    deleteItem.style.padding = '5px 10px';
    deleteItem.style.cursor = 'pointer';
    deleteItem.addEventListener('mouseenter', () => {
      deleteItem.style.backgroundColor = 'var(--hover-bg)';
    });
    deleteItem.addEventListener('mouseleave', () => {
      deleteItem.style.backgroundColor = '';
    });
    deleteItem.addEventListener('click', () => {
      this.deleteItem(entry.path);
      document.body.removeChild(menu);
    });
    menu.appendChild(deleteItem);
    
    // Add to body
    document.body.appendChild(menu);
    
    // Remove when clicking outside
    const removeMenu = (e) => {
      if (!menu.contains(e.target)) {
        document.body.removeChild(menu);
        document.removeEventListener('click', removeMenu);
      }
    };
    
    // Add delay to prevent immediate removal
    setTimeout(() => {
      document.addEventListener('click', removeMenu);
    }, 100);
  }
}

// Export the FileExplorer class
export default FileExplorer;