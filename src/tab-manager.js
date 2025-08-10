// tab-manager.js - Enhanced tab management system

class TabManager {
  constructor() {
    this.tabs = new Map(); // tabId -> tab object
    this.tabOrder = []; // Array of tab IDs in display order
    this.activeTabId = null;
    this.tabCounter = 0;
    this.maxTabWidth = 200;
    this.minTabWidth = 100;
    
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
  }

  // Create a new tab
  createTab(filePath, fileName, content = '') {
    const tabId = `tab_${++this.tabCounter}`;
    const tab = {
      id: tabId,
      filePath,
      fileName,
      content,
      originalContent: content, // Store original content for dirty checking
      isDirty: false,
      isTemporary: false, // For preview tabs
      lastModified: Date.now()
    };

    this.tabs.set(tabId, tab);
    this.tabOrder.push(tabId);
    this.activeTabId = tabId;
    
    // Ensure tabs are visible before rendering
    const editorTabs = document.getElementById("editor-tabs");
    if (editorTabs) {
      editorTabs.style.display = 'flex';
    }
    
    this.renderTabs();
    this.notifyTabChange(tab);
    
    // Also trigger tab switch to load content into editor
    this.notifyTabSwitch(null, tab);
    
    return tabId;
  }

  // Get tab by file path
  getTabByPath(filePath) {
    for (const [tabId, tab] of this.tabs) {
      if (tab.filePath === filePath) {
        return { id: tabId, ...tab };
      }
    }
    return null;
  }

  // Get tab by ID
  getTab(tabId) {
    const tab = this.tabs.get(tabId);
    return tab ? { id: tabId, ...tab } : null;
  }

  // Get active tab
  getActiveTab() {
    return this.activeTabId ? this.getTab(this.activeTabId) : null;
  }

  // Switch to tab
  switchToTab(tabId) {
    if (!this.tabs.has(tabId)) return false;
    
    const oldTab = this.getActiveTab();
    this.activeTabId = tabId;
    const newTab = this.getActiveTab();
    
    this.renderTabs();
    this.notifyTabSwitch(oldTab, newTab);
    
    return true;
  }

  // Switch to tab by file path
  switchToTabByPath(filePath) {
    const tab = this.getTabByPath(filePath);
    if (tab) {
      return this.switchToTab(tab.id);
    }
    return false;
  }

  // Close tab
  closeTab(tabId, force = false) {
    const tab = this.getTab(tabId);
    if (!tab) return false;

    // Check for unsaved changes
    if (tab.isDirty && !force) {
      const shouldClose = this.confirmCloseUnsaved(tab);
      if (!shouldClose) return false;
    }

    this.tabs.delete(tabId);
    this.tabOrder = this.tabOrder.filter(id => id !== tabId);

    // Switch to another tab if this was active
    if (this.activeTabId === tabId) {
      if (this.tabOrder.length > 0) {
        // Switch to the tab that was to the right, or the last tab
        const closedIndex = this.tabOrder.indexOf(tabId);
        const nextIndex = Math.min(closedIndex, this.tabOrder.length - 1);
        this.activeTabId = this.tabOrder[nextIndex] || this.tabOrder[this.tabOrder.length - 1];
      } else {
        this.activeTabId = null;
      }
    }

    this.renderTabs();
    this.notifyTabClose(tab);
    
    return true;
  }

  // Close tab by file path
  closeTabByPath(filePath) {
    const tab = this.getTabByPath(filePath);
    if (tab) {
      return this.closeTab(tab.id);
    }
    return false;
  }

  // Close all tabs
  closeAllTabs(force = false) {
    const tabIds = [...this.tabOrder];
    for (const tabId of tabIds) {
      if (!this.closeTab(tabId, force)) {
        return false; // User cancelled
      }
    }
    return true;
  }

  // Close all but active tab
  closeOtherTabs(keepTabId = null) {
    const targetTabId = keepTabId || this.activeTabId;
    if (!targetTabId) return false;

    const tabIds = [...this.tabOrder].filter(id => id !== targetTabId);
    for (const tabId of tabIds) {
      if (!this.closeTab(tabId)) {
        return false; // User cancelled
      }
    }
    return true;
  }

  // Mark tab as dirty (unsaved changes)
  markTabDirty(tabId, isDirty = true) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.isDirty = isDirty;
      this.renderTabs();
    }
  }

  // Update tab content
  updateTabContent(tabId, content) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      const wasClean = !tab.isDirty;
      tab.content = content;
      tab.lastModified = Date.now();
      
      // Mark as dirty if content changed
      if (wasClean && content !== tab.originalContent) {
        this.markTabDirty(tabId, true);
      }
    }
  }

  // Reorder tabs
  moveTab(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.tabOrder.length ||
        toIndex < 0 || toIndex >= this.tabOrder.length) {
      return false;
    }

    const tabId = this.tabOrder.splice(fromIndex, 1)[0];
    this.tabOrder.splice(toIndex, 0, tabId);
    
    this.renderTabs();
    return true;
  }

  // Get all tabs
  getAllTabs() {
    return this.tabOrder.map(id => this.getTab(id));
  }

  // Navigate tabs
  navigateTab(direction) {
    if (this.tabOrder.length <= 1) return false;

    const currentIndex = this.tabOrder.indexOf(this.activeTabId);
    let newIndex;

    if (direction === 'next') {
      newIndex = (currentIndex + 1) % this.tabOrder.length;
    } else {
      newIndex = currentIndex <= 0 ? this.tabOrder.length - 1 : currentIndex - 1;
    }

    return this.switchToTab(this.tabOrder[newIndex]);
  }

  // Render tabs in the DOM
  renderTabs() {
    const tabsContainer = document.getElementById("editor-tabs-tabs-section");
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';

    // Handle empty state
    if (this.tabOrder.length === 0) {
      const editorTabs = document.getElementById("editor-tabs");
      if (editorTabs) {
        editorTabs.style.display = 'none';
      }
      return;
    }

    // Show tabs container
    const editorTabs = document.getElementById("editor-tabs");
    if (editorTabs) {
      editorTabs.style.display = 'flex';
      // Force a reflow to ensure the display change takes effect
      editorTabs.offsetHeight;
    }

    // Render each tab
    this.tabOrder.forEach((tabId, index) => {
      const tab = this.tabs.get(tabId);
      if (!tab) return;

      const tabElement = this.createTabElement(tab, index);
      tabsContainer.appendChild(tabElement);
    });

    // Setup drag and drop
    this.setupDragAndDrop();
    
    // Ensure tabs container stays visible (double-check)
    if (editorTabs && this.tabOrder.length > 0) {
      editorTabs.style.display = 'flex';
    }
  }

  // Create tab DOM element
  createTabElement(tab, index) {
    const tabElement = document.createElement('div');
    tabElement.className = 'editor-tab';
    tabElement.dataset.tabId = tab.id;
    tabElement.dataset.filepath = tab.filePath;
    tabElement.draggable = true;

    if (tab.id === this.activeTabId) {
      tabElement.classList.add('active');
    }

    if (tab.isDirty) {
      tabElement.classList.add('dirty');
    }

    if (tab.isTemporary) {
      tabElement.classList.add('temporary');
    }

    // Tab icon
    const icon = document.createElement('span');
    icon.className = 'tab-icon';
    icon.innerHTML = this.getFileIcon(tab.fileName);

    // Tab name
    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = tab.fileName;
    
    // Add dirty indicator
    if (tab.isDirty) {
      name.textContent += ' ●';
    }

    // Close button
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.innerHTML = '×';
    close.title = 'Close tab';

    // Assemble tab
    tabElement.appendChild(icon);
    tabElement.appendChild(name);
    tabElement.appendChild(close);

    // Event listeners
    tabElement.addEventListener('click', (e) => {
      if (e.target === close) return; // Handle close separately
      this.switchToTab(tab.id);
    });

    close.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTab(tab.id);
    });

    tabElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showTabContextMenu(tab, e.clientX, e.clientY);
    });

    return tabElement;
  }

  // Get file icon (matches file explorer logic)
  getFileIcon(fileName) {
    // Use the same logic as file explorer
    if (window.fileExplorer && window.fileExplorer.getFileIcon) {
      const icon = window.fileExplorer.getFileIcon(fileName);
      return icon;
    }
    
    // Fallback that matches file explorer logic
    if (!window.settings?.icons) {
      // If settings aren't loaded yet, return a default
      return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
    }
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    // Use same mapping as file explorer
    let icon;
    switch (ext) {
      case 'js':
        icon = window.settings.icons.javascript;
        break;
      case 'html':
        icon = window.settings.icons.html;
        break;
      case 'css':
        icon = window.settings.icons.css;
        break;
      case 'json':
        icon = window.settings.icons.json;
        break;
      case 'md':
        icon = window.settings.icons.markdown;
        break;
      case 'py':
        icon = window.settings.icons.python;
        break;
      case 'rs':
        icon = window.settings.icons.rust;
        break;
      case 'go':
        icon = window.settings.icons.file; // Go uses default file icon
        break;
      default:
        icon = window.settings.icons.file;
        break;
    }
    
    // Fallback if icon is undefined
    if (!icon) {
      icon = window.settings.icons.file || '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
    }
    
    return icon;
  }

  // Setup drag and drop for tab reordering
  setupDragAndDrop() {
    const tabsContainer = document.getElementById("editor-tabs-tabs-section");
    if (!tabsContainer) return;

    let draggedTab = null;
    let draggedIndex = -1;

    tabsContainer.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('editor-tab')) {
        draggedTab = e.target;
        draggedIndex = Array.from(tabsContainer.children).indexOf(draggedTab);
        e.dataTransfer.effectAllowed = 'move';
        draggedTab.classList.add('dragging');
      }
    });

    tabsContainer.addEventListener('dragend', (e) => {
      if (draggedTab) {
        draggedTab.classList.remove('dragging');
        draggedTab = null;
        draggedIndex = -1;
      }
    });

    tabsContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (!draggedTab) return;

      const afterElement = this.getDragAfterElement(tabsContainer, e.clientX);
      if (afterElement == null) {
        tabsContainer.appendChild(draggedTab);
      } else {
        tabsContainer.insertBefore(draggedTab, afterElement);
      }
    });

    tabsContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      
      if (draggedTab && draggedIndex !== -1) {
        const newIndex = Array.from(tabsContainer.children).indexOf(draggedTab);
        if (newIndex !== draggedIndex) {
          this.moveTab(draggedIndex, newIndex);
        }
      }
    });
  }

  // Helper function for drag and drop
  getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.editor-tab:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // Show context menu for tab
  showTabContextMenu(tab, x, y) {
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu tab-context-menu';
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';

    const menuItems = [
      {
        label: 'Close',
        action: () => this.closeTab(tab.id)
      },
      {
        label: 'Close Others',
        action: () => this.closeOtherTabs(tab.id)
      },
      {
        label: 'Close All',
        action: () => this.closeAllTabs()
      },
      { separator: true },
      {
        label: 'Copy Path',
        action: () => navigator.clipboard.writeText(tab.filePath)
      },
      {
        label: 'Reveal in Explorer',
        action: () => this.revealInExplorer(tab.filePath)
      }
    ];

    menuItems.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        contextMenu.appendChild(separator);
      } else {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        menuItem.textContent = item.label;
        menuItem.addEventListener('click', () => {
          item.action();
          document.body.removeChild(contextMenu);
        });
        contextMenu.appendChild(menuItem);
      }
    });

    document.body.appendChild(contextMenu);

    // Remove context menu when clicking elsewhere
    const removeContextMenu = (e) => {
      if (!contextMenu.contains(e.target)) {
        document.body.removeChild(contextMenu);
        document.removeEventListener('click', removeContextMenu);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', removeContextMenu);
    }, 10);
  }

  // Setup keyboard shortcuts
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + W - Close current tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (this.activeTabId) {
          this.closeTab(this.activeTabId);
        }
      }

      // Ctrl/Cmd + Tab - Next tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        this.navigateTab('next');
      }

      // Ctrl/Cmd + Shift + Tab - Previous tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        this.navigateTab('prev');
      }

      // Ctrl/Cmd + Number - Switch to tab by index
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < this.tabOrder.length) {
          this.switchToTab(this.tabOrder[index]);
        }
      }
    });
  }

  // Setup general event listeners
  setupEventListeners() {
    // Listen for editor content changes to mark tabs dirty
    document.addEventListener('editor-content-changed', (e) => {
      const activeTab = this.getActiveTab();
      if (activeTab && e.detail.content !== undefined) {
        this.updateTabContent(activeTab.id, e.detail.content);
      }
    });
  }

  // Utility functions
  confirmCloseUnsaved(tab) {
    return confirm(`${tab.fileName} has unsaved changes. Close anyway?`);
  }

  revealInExplorer(filePath) {
    // Integration with file explorer
    if (window.fileExplorer && window.fileExplorer.revealFile) {
      window.fileExplorer.revealFile(filePath);
    }
  }

  // Event notification methods
  notifyTabChange(tab) {
    document.dispatchEvent(new CustomEvent('tab-created', {
      detail: { tab }
    }));
  }

  notifyTabSwitch(oldTab, newTab) {
    document.dispatchEvent(new CustomEvent('tab-switched', {
      detail: { oldTab, newTab }
    }));
  }

  notifyTabClose(tab) {
    document.dispatchEvent(new CustomEvent('tab-closed', {
      detail: { tab }
    }));
  }

  // Cleanup
  destroy() {
    // Remove all event listeners and clear data
    this.tabs.clear();
    this.tabOrder = [];
    this.activeTabId = null;
  }
}

export default TabManager;
