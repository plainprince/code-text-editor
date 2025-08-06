// draggable-panes.js - Implements resizable panes with drag handles

class DraggablePanes {
  constructor() {
    this.isDragging = false;
    this.currentResizer = null;
    this.startX = 0;
    this.startY = 0;
    this.startWidth = 0;
    this.startHeight = 0;
    
    this.minPaneSize = 150; // Minimum pane size in pixels
    this.maxPaneSize = window.innerWidth * 0.8; // Maximum pane size
    
    this.init();
  }
  
  init() {
    this.createResizers();
    this.setupEventListeners();
    this.loadPaneSizes();
  }
  
  createResizers() {
    // Create horizontal resizer between sidebar-left and main
    this.createHorizontalResizer('sidebar-left', 'main', 'left-resizer');
    
    // Create horizontal resizer between main and sidebar-right  
    this.createHorizontalResizer('main', 'sidebar-right', 'right-resizer');
    
    // Create vertical resizer for terminal (between main and terminal)
    this.createTerminalResizer();
  }
  
  createHorizontalResizer(leftPaneId, rightPaneId, resizerId) {
    const leftPane = document.getElementById(leftPaneId);
    const rightPane = document.getElementById(rightPaneId);
    const mainRow = document.getElementById('main-row');
    
    if (!leftPane || !rightPane || !mainRow) return;
    
    const resizer = document.createElement('div');
    resizer.id = resizerId;
    resizer.className = 'pane-resizer horizontal';
    resizer.dataset.leftPane = leftPaneId;
    resizer.dataset.rightPane = rightPaneId;
    resizer.dataset.direction = 'horizontal';
    
    // Insert resizer between the panes in main-row
    mainRow.insertBefore(resizer, rightPane);
  }
  
  createTerminalResizer() {
    const bottomPanelsContainer = document.getElementById('bottom-panels-container');
    const terminal = document.getElementById('terminal');
    
    if (!bottomPanelsContainer || !terminal) return;
    
    const resizer = document.createElement('div');
    resizer.id = 'terminal-resizer';
    resizer.className = 'pane-resizer vertical';
    resizer.dataset.topPane = 'main';
    resizer.dataset.bottomPane = 'terminal';
    resizer.dataset.direction = 'vertical';
    
    // Insert before terminal in the bottom panels container
    bottomPanelsContainer.insertBefore(resizer, terminal);
  }
  
  setupEventListeners() {
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    window.addEventListener('resize', this.handleWindowResize.bind(this));
  }
  
  handleMouseDown(e) {
    if (!e.target.classList.contains('pane-resizer')) return;
    
    this.isDragging = true;
    this.currentResizer = e.target;
    this.startX = e.clientX;
    this.startY = e.clientY;
    
    document.body.style.cursor = this.currentResizer.dataset.direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    
    e.preventDefault();
  }
  
  handleMouseMove(e) {
    if (!this.isDragging || !this.currentResizer) return;
    
    const direction = this.currentResizer.dataset.direction;
    
    if (direction === 'horizontal') {
      this.handleHorizontalResize(e);
    } else if (direction === 'vertical') {
      this.handleVerticalResize(e);
    }
    
    e.preventDefault();
  }
  
  handleHorizontalResize(e) {
    const deltaX = e.clientX - this.startX;
    const leftPaneId = this.currentResizer.dataset.leftPane;
    const rightPaneId = this.currentResizer.dataset.rightPane;
    const leftPane = document.getElementById(leftPaneId);
    const rightPane = document.getElementById(rightPaneId);
    const mainRow = document.getElementById('main-row');
    
    if (!leftPane || !rightPane || !mainRow) return;
    
    const leftRect = leftPane.getBoundingClientRect();
    const rightRect = rightPane.getBoundingClientRect();
    
    let newLeftWidth = leftRect.width + deltaX;
    let newRightWidth = rightRect.width - deltaX;
    
    // Enforce minimum and maximum sizes
    newLeftWidth = Math.max(this.minPaneSize, Math.min(newLeftWidth, this.maxPaneSize));
    
    if (rightPaneId === 'sidebar-right') {
      newRightWidth = Math.max(this.minPaneSize, newRightWidth);
      
      // Update grid template columns for main-row
      const isRightSidebarVisible = mainRow.classList.contains('right-sidebar-visible');
      if (isRightSidebarVisible) {
        mainRow.style.gridTemplateColumns = `${newLeftWidth}px 1fr ${newRightWidth}px`;
      }
      
      this.savePaneSize(rightPaneId, newRightWidth);
    } else {
      // For left sidebar only
      const currentColumns = getComputedStyle(mainRow).gridTemplateColumns.split(' ');
      if (currentColumns.length >= 3) {
        const rightWidth = currentColumns[2];
        mainRow.style.gridTemplateColumns = `${newLeftWidth}px 1fr ${rightWidth}`;
      }
    }
    
    this.startX = e.clientX;
    this.savePaneSize(leftPaneId, newLeftWidth);
  }
  
  handleVerticalResize(e) {
    const deltaY = e.clientY - this.startY;
    const terminal = document.getElementById('terminal');
    
    if (!terminal) return;
    
    const terminalRect = terminal.getBoundingClientRect();
    let newTerminalHeight = terminalRect.height - deltaY;
    
    // Enforce minimum and maximum sizes
    newTerminalHeight = Math.max(100, Math.min(newTerminalHeight, window.innerHeight * 0.6));
    
    terminal.style.height = `${newTerminalHeight}px`;
    terminal.style.flexBasis = `${newTerminalHeight}px`;
    terminal.style.flexShrink = '0';
    terminal.style.flexGrow = '0';
    
    this.startY = e.clientY;
    this.savePaneSize('terminal', newTerminalHeight);
  }
  
  handleMouseUp(e) {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.currentResizer = null;
    
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
  
  handleWindowResize() {
    // Update max pane size on window resize
    this.maxPaneSize = window.innerWidth * 0.8;
    
    // Ensure panes don't exceed new limits
    this.constrainPaneSizes();
  }
  
  constrainPaneSizes() {
    const panes = ['sidebar-left', 'sidebar-right', 'terminal'];
    
    panes.forEach(paneId => {
      const pane = document.getElementById(paneId);
      if (!pane) return;
      
      const rect = pane.getBoundingClientRect();
      
      if (paneId === 'terminal') {
        const maxHeight = window.innerHeight * 0.6;
        if (rect.height > maxHeight) {
          pane.style.height = `${maxHeight}px`;
          pane.style.flexBasis = `${maxHeight}px`;
        }
      } else {
        if (rect.width > this.maxPaneSize) {
          pane.style.width = `${this.maxPaneSize}px`;
          pane.style.flexBasis = `${this.maxPaneSize}px`;
        }
      }
    });
  }
  
  savePaneSize(paneId, size) {
    if (!window.settings) window.settings = {};
    if (!window.settings.paneSizes) window.settings.paneSizes = {};
    
    window.settings.paneSizes[paneId] = size;
    
    // Save to settings file (debounced)
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      if (window.saveSettings) {
        window.saveSettings();
      }
    }, 1000);
  }
  
  loadPaneSizes() {
    if (!window.settings?.paneSizes) return;
    
    const mainRow = document.getElementById('main-row');
    if (!mainRow) return;
    
    const leftWidth = window.settings.paneSizes['sidebar-left'] || 250;
    const rightWidth = window.settings.paneSizes['sidebar-right'] || 250;
    const terminalHeight = window.settings.paneSizes['terminal'] || 200;
    
    // Update grid template columns based on current visibility
    const isRightSidebarVisible = mainRow.classList.contains('right-sidebar-visible');
    if (isRightSidebarVisible) {
      mainRow.style.gridTemplateColumns = `${leftWidth}px 1fr ${rightWidth}px`;
    } else {
      mainRow.style.gridTemplateColumns = `${leftWidth}px 1fr 0px`;
    }
    
    // Set terminal height if visible
    const terminal = document.getElementById('terminal');
    if (terminal && terminal.style.display !== 'none') {
      terminal.style.height = `${terminalHeight}px`;
      terminal.style.flexBasis = `${terminalHeight}px`;
      terminal.style.flexShrink = '0';
      terminal.style.flexGrow = '0';
    }
  }
  
  resetPaneSizes() {
    const mainRow = document.getElementById('main-row');
    const terminal = document.getElementById('terminal');
    
    if (!mainRow) return;
    
    // Reset to default sizes
    const defaultLeftWidth = 250;
    const defaultRightWidth = 250;
    const defaultTerminalHeight = 200;
    
    // Update grid template columns
    const isRightSidebarVisible = mainRow.classList.contains('right-sidebar-visible');
    if (isRightSidebarVisible) {
      mainRow.style.gridTemplateColumns = `${defaultLeftWidth}px 1fr ${defaultRightWidth}px`;
    } else {
      mainRow.style.gridTemplateColumns = `${defaultLeftWidth}px 1fr 0px`;
    }
    
    // Reset terminal height
    if (terminal && terminal.style.display !== 'none') {
      terminal.style.height = `${defaultTerminalHeight}px`;
      terminal.style.flexBasis = `${defaultTerminalHeight}px`;
      terminal.style.flexShrink = '0';
      terminal.style.flexGrow = '0';
    }
    
    // Save the reset sizes
    this.savePaneSize('sidebar-left', defaultLeftWidth);
    this.savePaneSize('sidebar-right', defaultRightWidth);
    this.savePaneSize('terminal', defaultTerminalHeight);
  }
  
  // Method to update grid layout when panels are toggled
  updateLayout() {
    const mainRow = document.getElementById('main-row');
    if (!mainRow) return;
    
    const leftWidth = window.settings?.paneSizes?.['sidebar-left'] || 250;
    const rightWidth = window.settings?.paneSizes?.['sidebar-right'] || 250;
    
    const isRightSidebarVisible = mainRow.classList.contains('right-sidebar-visible');
    if (isRightSidebarVisible) {
      mainRow.style.gridTemplateColumns = `${leftWidth}px 1fr ${rightWidth}px`;
    } else {
      mainRow.style.gridTemplateColumns = `${leftWidth}px 1fr 0px`;
    }
  }
  
  // Method to handle terminal visibility changes
  updateTerminalLayout() {
    const terminal = document.getElementById('terminal');
    const terminalHeight = window.settings?.paneSizes?.['terminal'] || 200;
    
    if (terminal && terminal.style.display !== 'none') {
      terminal.style.height = `${terminalHeight}px`;
      terminal.style.flexBasis = `${terminalHeight}px`;
      terminal.style.flexShrink = '0';
      terminal.style.flexGrow = '0';
    }
  }
}

export default DraggablePanes;