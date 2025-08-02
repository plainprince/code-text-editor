// main.js - Main application logic

// Import modules
import FileExplorer from './file-explorer.js';
import Editor from './editor.js';

// Global state
let currentLeftPanel = "project-panel";
let currentRightPanel = null;
let openedFiles = [];
let currentFileId = null;
let fileExplorer = null;
let editorInstance = null;

// Initialize application
window.addEventListener("DOMContentLoaded", () => {
  // Set up event listeners
  setupPanelButtons();
  setupEditorButtons();
  setupWindowControls();
  setupCommandPalette();
  
  // Load settings
  loadSettings();
  
  // Initialize file explorer
  initFileExplorer();
});

// Panel management
function setLeftPanel(panel) {
  const sidebar = document.getElementById("sidebar-left");
  const projectBtn = document.getElementById("project-panel-button");
  const gitBtn = document.getElementById("git-panel-button");
  const outlineBtn = document.getElementById("outline-panel-button");
  const collabBtn = document.getElementById("collab-panel-button");
  const searchBtn = document.getElementById("search-project-button");

  const panelMap = {
    "project-panel": projectBtn,
    "git-panel": gitBtn,
    "outline-panel": outlineBtn,
    "collab-panel": collabBtn,
    "find-in-project-panel": searchBtn
  };

  // Remove highlight from all buttons
  Object.values(panelMap).forEach((btn) => {
    if (btn) btn.classList.remove("active-panel");
  });

  // Hide all panels
  const panels = sidebar.querySelectorAll("[id$='-panel']");
  panels.forEach(p => p.style.display = 'none');

  if (currentLeftPanel === panel) {
    // If the same panel is clicked, toggle it off
    sidebar.style.display = "none";
    currentLeftPanel = null;
    return;
  }
  
  // A panel is being opened or switched
  sidebar.style.display = "";
  currentLeftPanel = panel;

  // Show the correct panel and highlight the button
  const activeBtn = panelMap[panel];
  if (activeBtn) {
    activeBtn.classList.add("active-panel");
  }

  // Show the panel content
  const panelContent = document.getElementById(panel);
  if (panelContent) {
    panelContent.style.display = '';
  }
}

function setRightPanel(panel) {
  const sidebar = document.getElementById("sidebar-right");
  const aiBtn = document.getElementById("ai-panel-statusbar-button");

  const panelMap = {
    "ai-panel": aiBtn
  };

  // Remove highlight from all buttons
  Object.values(panelMap).forEach((btn) => {
    if (btn) btn.classList.remove("active-panel");
  });

  // Hide all panels
  const panels = sidebar.querySelectorAll("[id$='-panel']");
  panels.forEach(p => p.style.display = 'none');

  if (currentRightPanel === panel) {
    // If the same panel is clicked, toggle it off
    sidebar.style.display = "none";
    currentRightPanel = null;
    return;
  }
  
  // A panel is being opened or switched
  sidebar.style.display = "";
  currentRightPanel = panel;

  // Show the correct panel and highlight the button
  const activeBtn = panelMap[panel];
  if (activeBtn) {
    activeBtn.classList.add("active-panel");
  }

  // Show the panel content
  const panelContent = document.getElementById(panel);
  if (panelContent) {
    panelContent.style.display = '';
  }
}

// Setup functions
function setupPanelButtons() {
  document.getElementById("project-panel-button").addEventListener("click", () => setLeftPanel("project-panel"));
  document.getElementById("git-panel-button").addEventListener("click", () => setLeftPanel("git-panel"));
  document.getElementById("outline-panel-button").addEventListener("click", () => setLeftPanel("outline-panel"));
  document.getElementById("collab-panel-button").addEventListener("click", () => setLeftPanel("collab-panel"));
  document.getElementById("search-project-button").addEventListener("click", () => setLeftPanel("find-in-project-panel"));
  document.getElementById("ai-panel-statusbar-button").addEventListener("click", () => setRightPanel("ai-panel"));
  document.getElementById("terminal-statusbar-button").addEventListener("click", () => toggleTerminal());
}

function setupEditorButtons() {
  document.getElementById("search-tool-button").addEventListener("click", openSearch);
  document.getElementById("settings-tool-button").addEventListener("click", openSettings);
}

function setupWindowControls() {
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + , to open settings
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      openSettings();
    }
    
    // Ctrl/Cmd + S to save current file
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentFile();
    }
  });
}

function setupCommandPalette() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + P to open command palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      toggleCommandPalette();
    }
  });
  
  const cmdPalette = document.getElementById("command-palette");
  const cmdInput = document.getElementById("command-palette-input");
  
  cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cmdPalette.classList.add("hidden");
    }
  });
}

// Update editor function
function updateEditor(fileId, content) {
  const editorContainer = document.getElementById("editor");
  
  // Initialize editor if it doesn't exist
  if (!editorInstance) {
    // Hide welcome screen if it exists
    const welcomeScreen = document.getElementById("welcome-screen");
    if (welcomeScreen) {
      welcomeScreen.style.display = 'none';
    }
    
    // Create editor instance
    editorInstance = new Editor(editorContainer);
  }
  
  // Set content
  editorInstance.setContent(content);
  
  // Set current file
  if (fileId) {
    const file = openedFiles.find(file => file.id === fileId);
    if (file) {
      editorInstance.setCurrentFile(file);
    }
  }
}

// Update tabs function
function updateTabs() {
  const tabsContainer = document.getElementById("editor-tabs-tabs-section");
  tabsContainer.innerHTML = '';
  
  openedFiles.forEach(file => {
    const tab = document.createElement('div');
    tab.className = 'editor-tab';
    if (file.id === currentFileId) {
      tab.classList.add('active');
    }
    
    const icon = document.createElement('span');
    icon.className = 'tab-icon';
    icon.innerHTML = fileExplorer.getFileIcon(file.name);
    
    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = file.name;
    
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '×';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(file.id);
    });
    
    tab.appendChild(icon);
    tab.appendChild(name);
    tab.appendChild(close);
    
    tab.addEventListener('click', () => {
      currentFileId = file.id;
      updateTabs();
      updateEditor(file.id, file.content);
    });
    
    tabsContainer.appendChild(tab);
  });
}

// Close tab function
function closeTab(fileId) {
  fileExplorer.closeFile(fileId);
  updateTabs();
}

// Save current file function
async function saveCurrentFile() {
  if (!currentFileId) return;
  
  try {
    // Get current content from editor
    if (editorInstance) {
      const content = editorInstance.getContent();
      
      // Save using file explorer
      const success = await fileExplorer.saveFile(currentFileId, content);
      
      if (success) {
        showNotification('File saved');
      } else {
        showNotification('Error saving file', 'error');
      }
    }
  } catch (err) {
    console.error("Failed to save file:", err);
    showNotification('Error saving file', 'error');
  }
}

// Settings management
async function loadSettings() {
  try {
    // Try to load settings from file
    const content = await window.__TAURI__.fs.readTextFile('settings.json');
    const loadedSettings = JSON.parse(content);
    
    // Merge with default settings
    window.settings = { ...window.settings, ...loadedSettings };
  } catch (err) {
    // If settings file doesn't exist, create it
    saveSettings();
  }
}

async function saveSettings() {
  try {
    await window.__TAURI__.fs.writeTextFile('settings.json', JSON.stringify(window.settings, null, 2));
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
}

async function openSettings() {
  try {
    // Create settings file if it doesn't exist
    try {
      await window.__TAURI__.fs.readTextFile('settings.json');
    } catch (err) {
      await window.__TAURI__.fs.writeTextFile('settings.json', JSON.stringify(window.settings, null, 2));
    }
    
    // Open settings file
    const content = await window.__TAURI__.fs.readTextFile('settings.json');
    
    // Create a virtual file for the editor
    const settingsFile = {
      id: 'settings',
      name: 'settings.json',
      path: 'settings.json',
      content
    };
    
    // Add to opened files if not already open
    const existingTab = openedFiles.find(file => file.id === 'settings');
    if (!existingTab) {
      openedFiles.push(settingsFile);
    }
    
    // Set as current file
    currentFileId = 'settings';
    
    // Update UI
    updateTabs();
    updateEditor('settings', content);
    
    // Update filename in toolbar
    document.getElementById("editor-filename").textContent = 'settings.json';
  } catch (err) {
    console.error("Failed to open settings:", err);
  }
}

// UI functions
function toggleCommandPalette() {
  const cmdPalette = document.getElementById("command-palette");
  cmdPalette.classList.toggle("hidden");
  
  if (!cmdPalette.classList.contains("hidden")) {
    document.getElementById("command-palette-input").focus();
  }
}

function toggleTerminal() {
  const terminal = document.getElementById("terminal");
  terminal.style.display = terminal.style.display === 'none' ? 'block' : 'none';
}

function openSearch() {
  const searchInput = document.getElementById("find-in-project-input");
  setLeftPanel("find-in-project-panel");
  searchInput.focus();
}

function showNotification(message, type = 'info') {
  const notifications = document.getElementById("notification-previews");
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  notifications.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notifications.removeChild(notification);
    }, 300);
  }, 3000);
}

// Initialize file explorer
function initFileExplorer() {
  // Create file explorer instance
  fileExplorer = new FileExplorer();
  
  // Set up event listener for file opened
  document.addEventListener('file-opened', (e) => {
    const { id, path, name, content } = e.detail;
    
    // Check if file is already open
    const existingTab = openedFiles.find(file => file.id === id);
    
    if (!existingTab) {
      // Add to opened files
      openedFiles.push({
        id,
        path,
        name,
        content
      });
    }
    
    // Set as current file
    currentFileId = id;
    
    // Update UI
    updateTabs();
    updateEditor(id, content);
    
    // Update filename in toolbar
    document.getElementById("editor-filename").textContent = name;
  });
  
  // Set up event listener for no file selected
  document.addEventListener('no-file-selected', () => {
    currentFileId = null;
    
    if (editorInstance) {
      editorInstance.setContent('');
    }
    
    document.getElementById("editor-filename").textContent = '';
    updateTabs();
  });
  
  // Set up event listener for file closed
  document.addEventListener('file-closed', () => {
    updateTabs();
  });
  
  // Update open project button to use file explorer
  document.getElementById("open-project-button").addEventListener("click", async () => {
    const opened = await fileExplorer.openFolder();
    if (opened) {
      // Save last opened project
      window.settings.lastProject = fileExplorer.rootFolder;
      saveSettings();
      
      // Show project panel
      setLeftPanel("project-panel");
    }
  });
}