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
    
    // Create vertical resizer for terminal (between editor and terminal)
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
    const main = document.getElementById('main');
    const terminal = document.getElementById('terminal');
    
    if (!main || !terminal) return;
    
    const resizer = document.createElement('div');
    resizer.id = 'terminal-resizer';
    resizer.className = 'pane-resizer vertical';
    resizer.dataset.topPane = 'editor-area';
    resizer.dataset.bottomPane = 'terminal';
    resizer.dataset.direction = 'vertical';
    
    // Insert before terminal
    main.insertBefore(resizer, terminal);
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
    
    if (!leftPane || !rightPane) return;
    
    const leftRect = leftPane.getBoundingClientRect();
    const rightRect = rightPane.getBoundingClientRect();
    
    let newLeftWidth = leftRect.width + deltaX;
    let newRightWidth = rightRect.width - deltaX;
    
    // Enforce minimum and maximum sizes
    newLeftWidth = Math.max(this.minPaneSize, Math.min(newLeftWidth, this.maxPaneSize));
    newRightWidth = Math.max(this.minPaneSize, newRightWidth);
    
    // Apply new widths
    leftPane.style.width = `${newLeftWidth}px`;
    leftPane.style.flexBasis = `${newLeftWidth}px`;
    leftPane.style.flexShrink = '0';
    leftPane.style.flexGrow = '0';
    
    if (rightPaneId !== 'main') {
      rightPane.style.width = `${newRightWidth}px`;
      rightPane.style.flexBasis = `${newRightWidth}px`;
      rightPane.style.flexShrink = '0';
      rightPane.style.flexGrow = '0';
    }
    
    this.startX = e.clientX;
    this.savePaneSize(leftPaneId, newLeftWidth);
    
    if (rightPaneId !== 'main') {
      this.savePaneSize(rightPaneId, newRightWidth);
    }
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
    
    Object.entries(window.settings.paneSizes).forEach(([paneId, size]) => {
      const pane = document.getElementById(paneId);
      if (!pane || !size) return;
      
      if (paneId === 'terminal') {
        pane.style.height = `${size}px`;
        pane.style.flexBasis = `${size}px`;
      } else {
        pane.style.width = `${size}px`;
        pane.style.flexBasis = `${size}px`;
      }
      
      pane.style.flexShrink = '0';
      pane.style.flexGrow = paneId === 'main' ? '1' : '0';
    });
  }
  
  resetPaneSizes() {
    // Reset to default sizes
    const leftSidebar = document.getElementById('sidebar-left');
    const rightSidebar = document.getElementById('sidebar-right');
    const terminal = document.getElementById('terminal');
    
    if (leftSidebar) {
      leftSidebar.style.width = '300px';
      leftSidebar.style.flexBasis = '300px';
      this.savePaneSize('sidebar-left', 300);
    }
    
    if (rightSidebar) {
      rightSidebar.style.width = '300px';
      rightSidebar.style.flexBasis = '300px';
      this.savePaneSize('sidebar-right', 300);
    }
    
    if (terminal) {
      terminal.style.height = '200px';
      terminal.style.flexBasis = '200px';
      this.savePaneSize('terminal', 200);
    }
  }
}

export default DraggablePanes;