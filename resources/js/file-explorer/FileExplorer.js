/**
 * FileExplorer.js
 * Main FileExplorer class and entry point.
 * Imports and wires up all explorer modules.
 */

import { applyExplorerTheme } from "./explorer-theme.js";
import {
  renderFileList,
  updateSidebarHighlight,
  createFileIcon,
  createFileItem,
  createFolderDiv,
  updateSelection,
} from "./explorer-ui.js";
import ExplorerActions from "./explorer-actions.js";
import { bindExplorerEvents } from "./explorer-events.js";
import { ExplorerModal } from "./explorer-modal.js";
import {
  showContextMenu,
  hideContextMenu,
  getContextMenuItems,
} from "./explorer-contextmenu.js";
import { setupExplorerDnD } from "./explorer-dnd.js";
import ExplorerHistory from "./explorer-history.js";
import * as utils from "./explorer-utils.js";

export default class FileExplorer {
  constructor() {
    this.rootFolders = [];
    this.clipboard = null;
    this.clipboardType = null; // 'copy' or 'cut'
    this.searchResults = [];
    this.config = {};
    this.selectedItems = new Set(); // Use Set for better performance
    this.lastSelectedIndex = -1;
    this.contextMenuOpen = false;
    this.tooltipTimer = null;
    this.tooltipActive = false;
    this._openFolders = {};
    this._selectionAnchor = null; // For shift+click selection
    
    // History
    this.history = new ExplorerHistory(this);

    // Modal/dialog
    this.modal = document.getElementById("modal");
    this.modalHelper = new ExplorerModal(this.modal);

    // Actions
    this.actions = new ExplorerActions(this);

    // Init
    this.init();
  }

  async init() {
    await this.loadConfig();
    this.applyTheme();
    bindExplorerEvents(this);
    setupExplorerDnD(this);
    this.loadLastOpenedFolders();
    this.setupKeyboardShortcuts();
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          this.history.undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          this.history.redo();
        }
      }
    });
  }

  async loadConfig() {
    // Load config from settings (assume window.settings exists)
    this.config = window.settings.get("fileExplorer") || {};
    
    // Initialize default config if needed
    if (!this.config.lastOpened) {
      this.config.lastOpened = [];
    }
    if (!this.config.openFolders) {
      this.config.openFolders = {};
    }
    if (!this.config.selectedItems) {
      this.config.selectedItems = [];
    }
    
    // Load last opened folders
    this.rootFolders = [...this.config.lastOpened]; // Clone to avoid reference issues
    
    // Load folder state
    this._openFolders = {...this.config.openFolders}; // Clone to avoid reference issues
    
    // Load selection state
    this.selectedItems = new Set(this.config.selectedItems); // Convert array to Set
    this._selectionAnchor = null;
  }

  async loadLastOpenedFolders() {
    if (this.rootFolders.length > 0) {
      // Hide welcome screen
      const welcomeScreen = document.getElementById("welcome-screen");
      if (welcomeScreen) {
        welcomeScreen.style.display = "none";
      }
      
      // Show sidebar
      const sidebar = document.getElementById("sidebar-left");
      if (sidebar) {
        sidebar.style.display = "";
      }
      
      // Load folders
      await this.loadCurrentDirectory();
      
      // Restore selection
      if (this.selectedItems.length > 0) {
        const allItems = Array.from(document.querySelectorAll('.file-item:not([style*="display: none"]), .folder-header:not([style*="display: none"])'));
        allItems.forEach(item => {
          if (this.selectedItems.includes(item.dataset.path)) {
            item.classList.add('selected');
          }
        });
      }
    }
  }
  
  async saveWorkspaceState() {
    try {
      // Create a new config object to avoid reference issues
      const newConfig = {
        ...this.config,
        lastOpened: [...this.rootFolders],
        openFolders: {...this._openFolders},
        selectedItems: [...this.selectedItems] // Convert Set to array for storage
      };
      
      // Save to settings
      await window.settings.set("fileExplorer", newConfig);
      
      // Update local config
      this.config = newConfig;
    } catch (e) {
      console.error("[FileExplorer] Error saving workspace state:", e);
    }
  }

  applyTheme() {
    applyExplorerTheme(this.config);
  }

  // UI rendering
  async renderFileList(entries, container, rootFolder) {
    await renderFileList(entries, container, rootFolder, this);
  }

  // Modal dialogs
  async showInputDialog(title, message, defaultValue = "") {
    return this.modalHelper.showInputDialog(title, message, defaultValue);
  }
  async showConfirmDialog(title, message) {
    return this.modalHelper.showConfirmDialog(title, message);
  }
  hideModal() {
    this.modalHelper.hide();
  }

  // Context menu
  showContextMenu(event, context) {
    showContextMenu(event, context);
    this.contextMenuOpen = true;
  }
  hideContextMenu() {
    hideContextMenu();
    this.contextMenuOpen = false;
  }
  getContextMenuItems(context) {
    return getContextMenuItems(context);
  }

  cutItem(path) {
    this.actions.cutItem(path);
  }

  copyItem(path) {
    this.actions.copyItem(path);
  }

  pasteItem(path) {
    this.actions.pasteItem(path);
  }

  // Actions (delegated to ExplorerActions)
  async moveItem(src, dest, isUndo = false) {
    const success = await this.actions.moveItem(src, dest);
    if (success && !isUndo) {
        this.history.addAction({ type: 'move', from: src, to: dest });
    }
    return success;
  }
  async duplicateItem(src, dest) {
    return this.actions.duplicateItem(src, dest);
  }
  async renameItem(src, dest) {
    return this.actions.renameItem(src, dest);
  }
  async trashItem(path, trashPath) {
    return this.actions.trashItem(path, trashPath);
  }
  async deleteItem(path) {
    return this.actions.deleteItem(path);
  }
  async createNewFile(path) {
    return this.actions.createNewFile(path);
  }
  async createNewFolder(path) {
    return this.actions.createNewFolder(path);
  }

  async openFile(path) {
    return this.actions.openFile(path);
  }

  async toggleFolder(folderPath) {
    console.log(`Toggling folder: ${folderPath}`);
    const folderDiv = document.querySelector(`[data-path="${folderPath}"]`);
    if (!folderDiv) {
      console.error(`Folder element not found for path: ${folderPath}`);
      return;
    }

    // Toggle open state
    this._openFolders[folderPath] = !this._openFolders[folderPath];
    const isOpen = this._openFolders[folderPath];
    
    // Update folder icon
    const headerDiv = folderDiv.querySelector('.folder-header') || folderDiv.querySelector('.root-folder-header');
    if (headerDiv) {
        const iconSpan = headerDiv.querySelector('.file-icon');
        if (iconSpan) {
            const entry = { type: 'DIRECTORY', name: folderDiv.dataset.name };
            iconSpan.innerHTML = createFileIcon(entry, this.config, isOpen);
        }
    }

    // Add a CSS class to the folder div to indicate open/closed state
    if (isOpen) {
        folderDiv.classList.add('folder-open');
    } else {
        folderDiv.classList.remove('folder-open');
    }

    // Handle folder content
    if (isOpen) {
        try {
            // Get or create content div
            let contentDiv = folderDiv.querySelector('.folder-content');
            if (!contentDiv) {
                contentDiv = document.createElement('div');
                contentDiv.className = 'folder-content';
                folderDiv.appendChild(contentDiv);
            } else {
                // Show the content div if it exists
                contentDiv.style.display = '';
            }
            
            // Only clear and repopulate if it's empty
            if (contentDiv.children.length === 0) {
                // Load folder contents
                const entries = await this.getFolderContents(folderPath);
                
                if (!Array.isArray(entries) || entries.length === 0) {
                    console.log(`No entries found for ${folderPath}`);
                    return await this.saveWorkspaceState();
                }
                
                // Sort: folders first, then files, both alphabetically
                const sortedEntries = entries.sort((a, b) => {
                    if (a.type === "DIRECTORY" && b.type !== "DIRECTORY") return -1;
                    if (a.type !== "DIRECTORY" && b.type === "DIRECTORY") return 1;
                    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
                });

                console.log(`Rendering ${sortedEntries.length} entries for ${folderPath}`);
                
                // Create and append child elements directly (simplified approach)
                for (const entry of sortedEntries) {
                    const entryPath = `${folderPath}/${entry.name}`;
                    
                    if (entry.type === 'DIRECTORY') {
                        // For directories, create a simpler placeholder that will load contents when clicked
                        const folderElement = document.createElement('div');
                        folderElement.className = 'file-folder';
                        folderElement.dataset.path = entryPath;
                        folderElement.dataset.type = 'DIRECTORY';
                        folderElement.dataset.name = entry.name;
                        
                        // Create folder header
                        const folderHeader = document.createElement('div');
                        folderHeader.className = 'folder-header';
                        folderHeader.dataset.path = entryPath;
                        folderHeader.innerHTML = `
                            ${createFileIcon(entry, this.config, false)}
                            <div class="file-name">
                                <p>${entry.name}</p>
                            </div>
                        `;
                        
                        // Add click handler to folder header
                        folderHeader.addEventListener('click', (e) => {
                            if (e.detail === 1) { // single click
                                updateSelection(this, entryPath, e.ctrlKey, e.shiftKey, e.metaKey);
                                this.toggleFolder(entryPath);
                                e.stopPropagation(); // Prevent event bubbling
                            }
                        });
                        
                        // Add context menu handler
                        folderHeader.addEventListener('contextmenu', (e) => {
                            this.showContextMenu(e, {
                                path: entryPath,
                                type: 'DIRECTORY',
                                name: entry.name,
                                entry: entry
                            });
                            e.stopPropagation(); // Prevent event bubbling
                        });
                        
                        // Add tooltip handlers
                        folderHeader.addEventListener('mouseenter', (e) => {
                            this.startTooltipTimer(e, entryPath);
                        });
                        folderHeader.addEventListener('mouseleave', () => {
                            this.clearTooltipTimer();
                        });
                        
                        folderElement.appendChild(folderHeader);
                        contentDiv.appendChild(folderElement);
                    } else {
                        // For files, create a file item directly
                        const fileElement = await createFileItem({ 
                            ...entry, 
                            fullPath: entryPath 
                        }, folderPath, this, this.config);
                        
                        if (fileElement) {
                            contentDiv.appendChild(fileElement);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error toggling folder ${folderPath}:`, error);
            this.showNotification({ message: `Error opening folder: ${error.message}`, type: 'error' });
        }
    } else {
        // If closing folder, hide its contents but don't remove from DOM
        const contentDiv = folderDiv.querySelector('.folder-content');
        if (contentDiv) {
            contentDiv.style.display = 'none';
            // We don't clear the content - this allows for faster reopening
        }
    }

    await this.saveWorkspaceState();
  }

  // This method is now deprecated in favor of saveWorkspaceState
  async saveOpenFoldersState() {
    await this.saveWorkspaceState();
  }
  async undoLastAction() {
    return this.actions.undoLastAction();
  }

  // Utility
  showNotification(options) {
    if (typeof options === 'string') {
      options = { message: options };
    } else if (typeof options === 'object' && options !== null) {
      // If the message is an object, mark it as JSON
      if (typeof options.message === 'object' && options.message !== null) {
        options.isJson = true;
      }
    }
    showNotification(options);
  }

  // Add a root folder and refresh the explorer
  async addRootFolder(path) {
    if (!this.rootFolders.includes(path)) {
      this.rootFolders.push(path);
      // Load the new folder
      await this.loadSingleFolder(path);
      // Save workspace state
      await this.saveWorkspaceState();
      // Keep project panel active
      window.setLeftPanel("project-panel");
    }
  }

  // Load a single folder into the sidebar
  async loadSingleFolder(rootFolder) {
    console.log(`Loading folder: ${rootFolder}`);
    const sidebar = document.getElementById("sidebar-left");
    if (!sidebar) {
      console.error("Sidebar element not found");
      return;
    }
    
    let fileList = sidebar.querySelector("#file-list");
    if (!fileList) {
        fileList = document.createElement('div');
        fileList.id = 'file-list';
        sidebar.appendChild(fileList);
    }

    this._folderSnapshots = this._folderSnapshots || {};
    this._openFolders = this._openFolders || {};

    try {
      // Get folder contents for the root level
      const entries = await this.getFolderContents(rootFolder);
      
      if (!Array.isArray(entries)) {
        console.error(`Invalid entries returned for ${rootFolder}:`, entries);
        return;
      }
      
      console.log(`Loaded ${entries.length} entries for ${rootFolder}`);
      
      // Render the file list
      await this.renderFileList(entries, fileList, rootFolder);
      this._folderSnapshots[rootFolder] = entries;

      if (!this._pollInterval) {
        this._pollInterval = setInterval(() => this.pollForChanges(), 1000);
      }
    } catch (error) {
      console.error("Error loading folder:", error);
      this.showNotification({ message: `Error loading folder: ${error.message}`, type: 'error' });
    }
  }

  // Load and render the current directory/folders, with polling and snapshotting
  async loadCurrentDirectory() {
    const sidebar = document.getElementById("sidebar-left");
    let fileList = sidebar.querySelector("#file-list");
    if (!fileList) {
      fileList = document.createElement('div');
      fileList.id = 'file-list';
      sidebar.appendChild(fileList);
    }
    fileList.innerHTML = "";
    
    // Load each root folder
    for (const rootFolder of this.rootFolders) {
      await this.loadSingleFolder(rootFolder);
    }
    
    // Show welcome screen if no folders
    const welcomeScreen = document.getElementById("welcome-screen");
    if (welcomeScreen) {
      welcomeScreen.style.display = this.rootFolders.length === 0 ? "" : "none";
    }
  }

  // Read folder contents using Neutralino
  async getFolderContents(path) {
    try {
      // Use Neutralino API to read directory contents
      // The API returns an array of DirectoryEntry objects with entry, path, and type properties
      const entries = await Neutralino.filesystem.readDirectory(path);
      
      // Filter out unwanted files like .DS_Store
      const filteredEntries = entries.filter(entry => entry.entry !== '.DS_Store');
      
      // Ensure each entry has a name property (required for rendering)
      return filteredEntries.map(entry => ({
        ...entry,
        name: entry.entry
      }));
    } catch (e) {
      console.error("Error reading directory:", path, e);
      this.showNotification({ message: `Could not read directory: ${path}`, type: 'error' });
      return [];
    }
  }
  
  // Read folder contents recursively (including subfolders)
  async getRecursiveFolderContents(path, depth = 1) {
    try {
      // Limit recursion depth to avoid performance issues
      const maxDepth = 2;
      
      const entries = await this.getFolderContents(path);
      
      // Process each entry to add entries for directories
      const processedEntries = await Promise.all(entries.map(async entry => {
        const processedEntry = { 
          ...entry, 
          name: entry.entry,
          entry: entry.entry
        };
        
        if (entry.type === 'DIRECTORY' && depth < maxDepth) {
          // For directories, recursively get their contents but limit depth
          const subEntries = await this.getFolderContents(`${path}/${entry.entry}`);
          processedEntry.entries = subEntries.map(subEntry => ({
            ...subEntry,
            name: subEntry.entry,
            entry: subEntry.entry
          }));
        }
        
        return processedEntry;
      }));
      
      return processedEntries;
    } catch (e) {
      console.error("Error reading directory recursively:", path, e);
      this.showNotification({ message: `Could not read directory recursively: ${path}`, type: 'error' });
      return [];
    }
  }

  async findInProject(searchTerm) {
    const resultsContainer = document.getElementById("find-in-project-results");
    resultsContainer.innerHTML = "";

    if (!searchTerm) {
      return;
    }

    for (const rootFolder of this.rootFolders) {
      await this.searchInFolder(rootFolder, searchTerm, resultsContainer);
    }
  }

  async findInFolder(folderPath) {
    const searchTerm = await this.showInputDialog("Find in Folder", "Enter search term:");
    if (!searchTerm) return;

    window.setLeftPanel("find-in-project-panel"); 
    const resultsContainer = document.getElementById("find-in-project-results");
    resultsContainer.innerHTML = `Results for "${searchTerm}" in ${folderPath}:`;

    await this.searchInFolder(folderPath, searchTerm, resultsContainer);
  }
  
  async searchInFolder(folderPath, searchTerm, resultsContainer) {
    const entries = await Neutralino.filesystem.readDirectory(folderPath);

    for (const entry of entries) {
      const fullPath = `${folderPath}/${entry.entry}`;
      if (entry.type === "FILE") {
        try {
          const content = await Neutralino.filesystem.readFile(fullPath);
          if (content.includes(searchTerm)) {
            const result = document.createElement("div");
            result.className = "search-result-item";
            result.textContent = fullPath;
            resultsContainer.appendChild(result);
          }
        } catch (error) {
          console.error(`Error reading file ${fullPath}:`, error);
        }
      } else if (entry.type === "DIRECTORY") {
        await this.searchInFolder(fullPath, searchTerm, resultsContainer);
      }
    }
  }

  // Poll for changes in all root folders
  async pollForChanges() {
    if (!this.rootFolders || this.rootFolders.length === 0) return;
    const sidebar = document.getElementById("sidebar-left");
    let fileList = sidebar.querySelector("#file-list");
    if (!fileList) {
      fileList = document.createElement('div');
      fileList.id = 'file-list';
      sidebar.appendChild(fileList);
    }
    
    let needsRerender = false;
    for (const rootFolder of this.rootFolders) {
      // Use recursive loading for polling as well
      const newEntries = await this.getRecursiveFolderContents(rootFolder);
      const oldEntries = this._folderSnapshots[rootFolder] || [];
      if (!this._snapshotsEqual(oldEntries, newEntries)) {
        needsRerender = true;
        this._folderSnapshots[rootFolder] = newEntries;
      }
    }
    
    if (needsRerender) {
      fileList.innerHTML = "";
      for (const rootFolder of this.rootFolders) {
        const entries = this._folderSnapshots[rootFolder];
        await this.renderFileList(entries, sidebar, rootFolder);
      }
    }
  }

  // Compare two folder snapshots (shallow compare by name/type)
  _snapshotsEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return false;
    }
    const aString = JSON.stringify(a.map(item => ({name: item.name, type: item.type}))).replace(/"/g, '');
    const bString = JSON.stringify(b.map(item => ({name: item.name, type: item.type}))).replace(/"/g, '');
    return aString === bString;
  }

  // Tooltip methods
  startTooltipTimer(event, path) {
    this.clearTooltipTimer();
    this.tooltipTimer = setTimeout(() => {
      this.showTooltip(event, path);
      this.tooltipActive = true;
    }, 500); // 500ms delay
  }

  clearTooltipTimer() {
    clearTimeout(this.tooltipTimer);
    if (this.tooltipActive) {
      this.hideTooltip();
      this.tooltipActive = false;
    }
  }

  showTooltip(event, path) {
    const tooltip = document.createElement('div');
    tooltip.id = 'file-tooltip';
    tooltip.className = 'tooltip';
    tooltip.textContent = path;
    document.body.appendChild(tooltip);

    // Position tooltip near the mouse
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
  }

  hideTooltip() {
    const tooltip = document.getElementById('file-tooltip');
    if (tooltip) {
      tooltip.parentNode.removeChild(tooltip);
    }
  }
}

// Optionally: expose utils if needed
export { utils };