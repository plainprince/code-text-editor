/**
 * FileExplorer.js
 * Main FileExplorer class and entry point.
 * Imports and wires up all explorer modules.
 */

import { applyExplorerTheme } from "./explorer-theme.js";
import {
  renderFileList,
  updateSidebarHighlight,
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
    this.selectedItem = null;
    this.selectedItems = [];
    this.contextMenuOpen = false;
    this.tooltipTimer = null;
    this.tooltipActive = false;
    
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
    this.config = window.settings.get("fileExplorer");
    this.rootFolders = this.config.lastOpened || [];
  }

  async loadLastOpenedFolders() {
    if (this.rootFolders.length > 0) {
      document.getElementById("welcome-screen").style.display = "none";
      await this.loadCurrentDirectory();
    }
  }

  applyTheme() {
    applyExplorerTheme(this.config);
  }

  // UI rendering
  renderFileList(entries, container, rootFolder) {
    renderFileList(entries, container, rootFolder, this);
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
  async undoLastAction() {
    return this.actions.undoLastAction();
  }

  // Utility
  showNotification(message, type) {
    showNotification({ message, type });
  }

  // Add a root folder and refresh the explorer
  addRootFolder(path) {
    if (!this.rootFolders.includes(path)) {
      this.rootFolders.push(path);
      this.loadSingleFolder(path); // Only load the new folder
      window.settings.set("fileExplorer.lastOpened", this.rootFolders);
    }
    // Always keep sidebar open when adding a folder
    const sidebar = document.getElementById("sidebar-left");
    if (sidebar) {
      sidebar.style.display = "";
    }
  }

  // Load a single folder into the sidebar
  async loadSingleFolder(rootFolder) {
    const sidebar = document.getElementById("sidebar-left");
    let fileList = sidebar.querySelector("#file-list");
    if (!fileList) {
        fileList = document.createElement('div');
        fileList.id = 'file-list';
        sidebar.appendChild(fileList);
    }

    this._folderSnapshots = this._folderSnapshots || {};
    this._openFolders = this._openFolders || {};

    const entries = await this.getFolderContents(rootFolder, true);
    this.renderFileList(entries, fileList, rootFolder);
    this._folderSnapshots[rootFolder] = entries;

    if (!this._pollInterval) {
      this._pollInterval = setInterval(() => this.pollForChanges(), 1000);
    }
  }

  // Load and render the current directory/folders, with polling and snapshotting
  async loadCurrentDirectory() {
    const sidebar = document.getElementById("sidebar-left");
    const fileList = sidebar.querySelector("#file-list");
    if (fileList) {
      fileList.innerHTML = "";
    }
    for (const rootFolder of this.rootFolders) {
      await this.loadSingleFolder(rootFolder);
    }
  }

  // Read folder contents using Neutralino, now with recursive fetching
  async getFolderContents(path, isRoot = false) {
    try {
      let entries = [];
      const result = await Neutralino.filesystem.readDirectory(path);

      for (const e of result) {
        const entryPath = `${path}/${e.entry}`;
        const entry = {
          name: e.entry,
          type: e.type,
          fullPath: entryPath,
          absPath: entryPath,
          entries: e.type === "DIRECTORY" ? [] : undefined,
        };

        if (e.type === "DIRECTORY") {
          // If this is a directory, check if it should be open
          const isOpen = this._openFolders ? this._openFolders[entryPath] : isRoot;
          if (isOpen) {
            entry.entries = await this.getFolderContents(entryPath, false);
          }
        }
        entries.push(entry);
      }
      return entries;
    } catch (e) {
      console.error("Error reading directory:", path, e);
      // Optional: Propagate error to UI
      this.showNotification({ message: `Could not read directory: ${path}`, type: 'error' });
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
    let needsRerender = false;
    for (const rootFolder of this.rootFolders) {
      // Pass `true` to ensure root folders are checked
      const newEntries = await this.getFolderContents(rootFolder, true);
      const oldEntries = this._folderSnapshots[rootFolder] || [];
      if (!this._snapshotsEqual(oldEntries, newEntries)) {
        needsRerender = true;
        this._folderSnapshots[rootFolder] = newEntries;
      }
    }
    if (needsRerender) {
      sidebar.innerHTML = "";
      for (const rootFolder of this.rootFolders) {
        const entries = this._folderSnapshots[rootFolder];
        this.renderFileList(entries, sidebar, rootFolder);
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