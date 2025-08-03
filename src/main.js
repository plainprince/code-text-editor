// main.js - Main application logic

// Import modules
import FileExplorer from './file-explorer.js';
import Editor from './editor.js';
import Terminal from './terminal.js';
import DraggablePanes from './draggable-panes.js';
import { getWorkspaceFiles } from './file-system.js';
import * as monaco from 'monaco-editor';


// Global state
let currentLeftPanel = "project-panel";
let currentRightPanel = null;
let openedFiles = [];
let currentFileId = null;
let fileExplorer = null;
let editorInstance = null;
let terminalInstance = null;
let draggablePanes = null;
let workspaceFiles = [];
let settingsWatcher = null;
let availableCommands = [
  { id: 'open-settings', name: 'Open Settings', action: () => openSettings() },
  { id: 'open-project', name: 'Open Project', action: () => document.getElementById("open-project-button").click() },
  { id: 'toggle-terminal', name: 'Toggle Terminal', action: () => toggleTerminal() },
  { id: 'search-files', name: 'Search in Files', action: () => openSearch() }
];

// Initialize application
window.addEventListener("DOMContentLoaded", () => {
  // Set up event listeners
  setupPanelButtons();
  setupEditorButtons();
  setupWindowControls();
  setupCommandPalette();
  
  // Load settings and restore last workspace
  loadSettings().then(() => {
    // Apply initial theme
    applyTheme(window.settings.theme || 'dark');
    restoreLastWorkspace();
  });
  
  // Initialize file explorer
  initFileExplorer();
  
  // Initialize terminal
  initTerminal();
  
  // Initialize settings watcher
  initSettingsWatcher();
  
  // Initialize draggable panes
  initDraggablePanes();
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

      if (currentLeftPanel === panel && panel !== 'project-panel') {
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
    // Ctrl/Cmd + P to open file palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      openFilePalette();
    }
    // Ctrl/Cmd + Shift + P to open command palette
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      openCommandPalette();
    }
  });
  
  const cmdPalette = document.getElementById("command-palette");
  const cmdInput = document.getElementById("command-palette-input");
  const cmdResults = document.getElementById("command-palette-results");
  
  cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cmdPalette.classList.add("hidden");
      cmdInput.value = '';
      cmdResults.innerHTML = '';
    } else if (e.key === 'Enter') {
      const selected = cmdResults.querySelector('.selected');
      if (selected) {
        selected.click();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateResults(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateResults(-1);
    }
  });
  
  cmdInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const mode = cmdPalette.dataset.mode;
    
    if (mode === 'files') {
      filterFiles(query);
    } else if (mode === 'commands') {
      filterCommands(query);
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
  // Let file explorer handle the closing logic
  fileExplorer.closeFile(fileId);
  // The file-closed event will handle the rest
}

// Save current file function
async function saveCurrentFile() {
  if (!currentFileId) return;
  
  try {
    // Get current content from editor
    if (editorInstance) {
      const content = editorInstance.getContent();
      
      // Special handling for settings file
      if (currentFileId === 'settings') {
        try {
          // Parse and validate the settings JSON
          const newSettings = JSON.parse(content);
          
          // Update the global settings object
          window.settings = { ...window.settings, ...newSettings };
          
          // Save to the store
          await saveSettings();
          
          // Update the opened file content
          const settingsTab = openedFiles.find(file => file.id === 'settings');
          if (settingsTab) {
            settingsTab.content = content;
          }
          
          // Settings saved silently
          return;
        } catch (parseErr) {
          console.error("Invalid JSON in settings:", parseErr);
          showNotification('Invalid JSON in settings file', 'error');
          return;
        }
      }
      
      // Save regular files using file explorer
      const success = await fileExplorer.saveFile(currentFileId, content);
      
      if (!success) {
        showNotification('Error saving file', 'error');
      }
    }
  } catch (err) {
    console.error("Failed to save file:", err);
    showNotification('Error saving file', 'error');
  }
}

// Settings management using Rust file operations
let settingsFilePath = null;

// Get the settings file path
async function getSettingsFilePath() {
  if (!settingsFilePath) {
    try {
      settingsFilePath = await window.__TAURI__.core.invoke("get_settings_file_path");
    } catch (err) {
      console.error("Failed to get settings file path:", err);
      // Fallback to a default path if needed
      settingsFilePath = "settings.json";
    }
  }
  return settingsFilePath;
}

async function loadSettings() {
  try {
    const filePath = await getSettingsFilePath();
    
    // Check if settings file exists
    const exists = await window.__TAURI__.core.invoke("file_exists", { filePath });
    
    if (!exists) {
      // File doesn't exist, save default settings
      await saveSettings();
      return;
    }
    
    // Read settings file
    const content = await window.__TAURI__.core.invoke("read_text_file", { filePath });
    const loadedSettings = JSON.parse(content);
    
    // Merge loaded settings with current settings
    window.settings = { ...window.settings, ...loadedSettings };
  } catch (err) {
    console.error('Error loading settings:', err);
    // If there's any error, try to create the file with default settings
    await saveSettings();
  }
}

async function saveSettings() {
  try {
    const filePath = await getSettingsFilePath();
    const content = JSON.stringify(window.settings, null, 2);
    
    // Write settings to file
    await window.__TAURI__.core.invoke("write_text_file", { filePath, content });
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
}

async function openSettings() {
  try {
    // Ensure settings are loaded
    await loadSettings();
    
    // Create JSON representation of current settings
    const content = JSON.stringify(window.settings, null, 2);
    
    // Create a virtual file for the editor
    const settingsFile = {
      id: 'settings',
      name: 'settings.json',
      path: 'settings.json',
      content
    };
    
    const existingTab = openedFiles.find(file => file.id === 'settings');
    if (!existingTab) {
      openedFiles.push(settingsFile);
    } else {
      // Update existing tab with current settings
      existingTab.content = content;
    }
    
    currentFileId = 'settings';
    updateTabs();
    updateEditor('settings', content);
    document.getElementById("editor-filename").textContent = 'settings.json';
  } catch (err) {
    console.error("Failed to open settings:", err);
  }
}

// Restore the last opened workspace
async function restoreLastWorkspace() {
  try {
    if (window.settings.lastProject) {
      // Try to open the last project
      const opened = await fileExplorer.openFolderByPath(window.settings.lastProject);
      if (opened) {
        // Show project panel
        setLeftPanel("project-panel");
      } else {
        // If failed to open, clear the invalid path
        window.settings.lastProject = null;
        await saveSettings();
      }
    }
  } catch (err) {
    console.error("Failed to restore last workspace:", err);
    // Clear invalid workspace setting
    window.settings.lastProject = null;
    await saveSettings();
  }
}

// UI functions
function toggleCommandPalette() {
  // Legacy function - now calls the new command palette
  openCommandPalette();
}

function toggleTerminal() {
  if (terminalInstance) {
    terminalInstance.toggle();
  }
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
    
    // Destroy editor instance and show welcome screen
    if (editorInstance) {
      editorInstance.destroy();
      editorInstance = null;
    }
    
    // Show welcome screen
    const welcomeScreen = document.getElementById("welcome-screen");
    if (welcomeScreen) {
      welcomeScreen.style.display = 'flex';
    }
    
    document.getElementById("editor-filename").textContent = '';
    updateTabs();
  });
  
  // Set up event listener for file closed
  document.addEventListener('file-closed', (e) => {
    const { id } = e.detail;
    
    // Remove from main.js openedFiles array
    const fileIndex = openedFiles.findIndex(f => f.id === id);
    if (fileIndex !== -1) {
      openedFiles.splice(fileIndex, 1);
    }
    
    // If we just closed the current file, handle the state
    if (currentFileId === id) {
      if (openedFiles.length > 0) {
        // The file explorer should have already set a new selected file
        // Get the new selected file from file explorer
        if (fileExplorer.selectedFile) {
          currentFileId = fileExplorer.selectedFile;
          const file = openedFiles.find(f => f.id === currentFileId);
          if (file) {
            updateEditor(currentFileId, file.content);
            document.getElementById("editor-filename").textContent = file.name;
          }
        } else {
          // Fallback to first file
          currentFileId = openedFiles[0].id;
          updateEditor(currentFileId, openedFiles[0].content);
          document.getElementById("editor-filename").textContent = openedFiles[0].name;
        }
      } else {
        // No files left open - show welcome screen
        currentFileId = null;
        
        // Destroy editor instance and show welcome screen
        if (editorInstance) {
          editorInstance.destroy();
          editorInstance = null;
        }
        
        // Show welcome screen
        const welcomeScreen = document.getElementById("welcome-screen");
        if (welcomeScreen) {
          welcomeScreen.style.display = 'flex';
        }
        
        document.getElementById("editor-filename").textContent = '';
      }
    }
    
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
      
      // Load workspace files for command palette
      try {
        workspaceFiles = await getWorkspaceFiles(fileExplorer.rootFolder);
      } catch (err) {
        console.error("Failed to load workspace files:", err);
      }
    }
  });
}

// Command Palette Functions
async function openFilePalette() {
  if (!fileExplorer || !fileExplorer.rootFolder) {
    showNotification('No project opened', 'error');
    return;
  }
  
  const cmdPalette = document.getElementById("command-palette");
  const cmdInput = document.getElementById("command-palette-input");
  const cmdResults = document.getElementById("command-palette-results");
  
  cmdPalette.dataset.mode = 'files';
  cmdInput.placeholder = 'Search files...';
  cmdInput.value = '';
  cmdResults.innerHTML = '';
  
  // Load workspace files if not already loaded
  if (workspaceFiles.length === 0) {
    try {
      workspaceFiles = await getWorkspaceFiles(fileExplorer.rootFolder);
    } catch (err) {
      console.error("Failed to load workspace files:", err);
      showNotification('Failed to load workspace files', 'error');
      return;
    }
  }
  
  // Show all files initially
  displayFiles(workspaceFiles.slice(0, 20)); // Limit to first 20 for performance
  
  cmdPalette.classList.remove("hidden");
  cmdInput.focus();
}

function openCommandPalette() {
  const cmdPalette = document.getElementById("command-palette");
  const cmdInput = document.getElementById("command-palette-input");
  const cmdResults = document.getElementById("command-palette-results");
  
  cmdPalette.dataset.mode = 'commands';
  cmdInput.placeholder = 'Type a command...';
  cmdInput.value = '';
  cmdResults.innerHTML = '';
  
  // Show all commands initially
  displayCommands(availableCommands);
  
  cmdPalette.classList.remove("hidden");
  cmdInput.focus();
}

function filterFiles(query) {
  if (!query) {
    displayFiles(workspaceFiles.slice(0, 20));
    return;
  }
  
  const filtered = workspaceFiles.filter(file => 
    file.relativePath.toLowerCase().includes(query) ||
    file.name.toLowerCase().includes(query)
  ).slice(0, 20);
  
  displayFiles(filtered);
}

function filterCommands(query) {
  if (!query) {
    displayCommands(availableCommands);
    return;
  }
  
  const filtered = availableCommands.filter(cmd => 
    cmd.name.toLowerCase().includes(query)
  );
  
  displayCommands(filtered);
}

function displayFiles(files) {
  const cmdResults = document.getElementById("command-palette-results");
  cmdResults.innerHTML = '';
  
  files.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'command-item';
    if (index === 0) item.classList.add('selected');
    
    const icon = fileExplorer.getFileIcon(file.name);
    item.innerHTML = `
      <span class="command-icon">${icon}</span>
      <span class="command-name">${file.name}</span>
      <span class="command-description">${file.relativePath}</span>
    `;
    
    item.addEventListener('click', () => openFileFromPalette(file));
    cmdResults.appendChild(item);
  });
}

function displayCommands(commands) {
  const cmdResults = document.getElementById("command-palette-results");
  cmdResults.innerHTML = '';
  
  commands.forEach((cmd, index) => {
    const item = document.createElement('div');
    item.className = 'command-item';
    if (index === 0) item.classList.add('selected');
    
    item.innerHTML = `
      <span class="command-icon">⚡</span>
      <span class="command-name">${cmd.name}</span>
    `;
    
    item.addEventListener('click', () => executeCommand(cmd));
    cmdResults.appendChild(item);
  });
}

function navigateResults(direction) {
  const results = document.querySelectorAll('.command-item');
  const current = document.querySelector('.command-item.selected');
  
  if (!results.length) return;
  
  let newIndex = 0;
  if (current) {
    const currentIndex = Array.from(results).indexOf(current);
    newIndex = currentIndex + direction;
    
    if (newIndex < 0) newIndex = results.length - 1;
    if (newIndex >= results.length) newIndex = 0;
    
    current.classList.remove('selected');
  }
  
  results[newIndex].classList.add('selected');
}

async function openFileFromPalette(file) {
  const cmdPalette = document.getElementById("command-palette");
  cmdPalette.classList.add("hidden");
  
  try {
    await fileExplorer.openFileByPath(file.path);
  } catch (err) {
    console.error("Failed to open file:", err);
    showNotification('Failed to open file', 'error');
  }
}

function executeCommand(cmd) {
  const cmdPalette = document.getElementById("command-palette");
  cmdPalette.classList.add("hidden");
  
  try {
    cmd.action();
  } catch (err) {
    console.error("Failed to execute command:", err);
    showNotification('Failed to execute command', 'error');
  }
}

// Initialize terminal
function initTerminal() {
  terminalInstance = new Terminal(document.getElementById("terminal"));
  
  // Set up close button
  const closeButton = document.getElementById("close-terminal-button");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      terminalInstance.hide();
    });
  }
  
  // Set working directory when project is opened
  document.addEventListener('folder-opened', (e) => {
    if (terminalInstance && e.detail.path) {
      terminalInstance.setWorkingDirectory(e.detail.path);
    }
  });
}

// Initialize settings watcher
function initSettingsWatcher() {
  // Check for settings changes every 2 seconds
  settingsWatcher = setInterval(async () => {
    try {
      const filePath = await getSettingsFilePath();
      const exists = await window.__TAURI__.core.invoke("file_exists", { filePath });
      
      if (exists) {
        const content = await window.__TAURI__.core.invoke("read_text_file", { filePath });
        const loadedSettings = JSON.parse(content);
        
        // Check if settings have changed
        if (JSON.stringify(window.settings) !== JSON.stringify(loadedSettings)) {
          // Settings changed, update and apply them
          const oldSettings = { ...window.settings };
          window.settings = { ...window.settings, ...loadedSettings };
          
          applySettingsChanges(oldSettings, window.settings);
        }
      }
    } catch (err) {
      // Silently fail - settings file might not exist yet or be invalid
    }
  }, 2000);
}

// Apply settings changes to the UI
function applySettingsChanges(oldSettings, newSettings) {
  // Apply theme changes
  if (oldSettings.theme !== newSettings.theme) {
    applyTheme(newSettings.theme);
  }
  
  // Apply font size changes to Monaco Editor
  if (oldSettings.fontSize !== newSettings.fontSize && editorInstance) {
    editorInstance.editor?.updateOptions({
      fontSize: newSettings.fontSize
    });
  }
  
  // Apply tab size changes to Monaco Editor
  if (oldSettings.tabSize !== newSettings.tabSize && editorInstance) {
    editorInstance.editor?.updateOptions({
      tabSize: newSettings.tabSize
    });
  }
  
  // Update opened settings tab if it exists
  const settingsTab = openedFiles.find(file => file.id === 'settings');
  if (settingsTab) {
    settingsTab.content = JSON.stringify(newSettings, null, 2);
    if (currentFileId === 'settings' && editorInstance) {
      editorInstance.setContent(settingsTab.content);
    }
  }
  
  console.log('Settings applied:', newSettings);
}

// Apply theme to the application
function applyTheme(theme) {
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.style.setProperty('--bg-color', '#1e1e1e');
    root.style.setProperty('--text-color', '#d4d4d4');
    root.style.setProperty('--sidebar-bg', '#252526');
    root.style.setProperty('--border-color', '#464647');
    root.style.setProperty('--button-bg', '#0e639c');
    root.style.setProperty('--button-hover-bg', '#094771');
    root.style.setProperty('--input-bg', '#3c3c3c');
    root.style.setProperty('--active-tab-bg', '#1e1e1e');
    root.style.setProperty('--inactive-tab-bg', '#2d2d30');
  } else if (theme === 'light') {
    root.style.setProperty('--bg-color', '#ffffff');
    root.style.setProperty('--text-color', '#000000');
    root.style.setProperty('--sidebar-bg', '#f3f3f3');
    root.style.setProperty('--border-color', '#cccccc');
    root.style.setProperty('--button-bg', '#0078d4');
    root.style.setProperty('--button-hover-bg', '#106ebe');
    root.style.setProperty('--input-bg', '#ffffff');
    root.style.setProperty('--active-tab-bg', '#ffffff');
    root.style.setProperty('--inactive-tab-bg', '#f3f3f3');
  }
  
  // Update Monaco Editor theme
  if (editorInstance && editorInstance.editor) {
    const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';
    monaco.editor.setTheme(monacoTheme);
  }
}

// Initialize draggable panes
function initDraggablePanes() {
  draggablePanes = new DraggablePanes();
  
  // Add reset pane sizes command
  availableCommands.push({
    id: 'reset-pane-sizes', 
    name: 'Reset Pane Sizes', 
    action: () => draggablePanes.resetPaneSizes()
  });
}