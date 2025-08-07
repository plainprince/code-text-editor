// main.js - Main application logic

// Import modules
import FileExplorer from './file-explorer.js';
import Editor from './editor.js';
import { TerminalManager } from './terminal.js';
import DiagnosticsManager from './diagnostics.js';
import DraggablePanes from './draggable-panes.js';
import { getWorkspaceFiles, searchInFiles } from './file-system.js';
import { writeTextFile, shutdownAllLanguageServers } from './tauri-helpers.js';
import OutlinePanel from './outline.js';

import * as monaco from 'monaco-editor';

window.addEventListener('beforeunload', () => {
  shutdownAllLanguageServers();
});


// Global state
let currentLeftPanel = "project-panel";
let currentRightPanel = null;
let currentBottomPanel = null;
let openTabs = new Set(); // Simple set of file paths
let currentFilePath = null;
let fileExplorer = null;
let editorInstance = null;
let outlinePanel = null;

let terminalInstance = null;
let diagnosticsManager = null;
let draggablePanes = null;
let workspaceFiles = [];
let settingsWatcher = null;

// Make Tauri available globally for modules that have import issues
window.tauri = window.__TAURI__;
let availableCommands = [
  { id: 'open-settings', name: 'Open Settings', action: () => openSettings() },
  { id: 'open-project', name: 'Open Project', action: () => document.getElementById("open-project-button").click() },
  { id: 'toggle-terminal', name: 'Toggle Terminal', action: () => toggleTerminal() },
  { id: 'search-files', name: 'Search in Files', action: () => openSearch() },

];

// Initialize application
window.addEventListener("DOMContentLoaded", async () => {
  // Set up event listeners
  setupPanelButtons();
  setupEditorButtons();
  setupWindowControls();
  setupCommandPalette();
  
  // Load settings
  await loadSettings();
  // Apply initial theme
  applyTheme(window.settings.theme || 'dark');
  
  // Initialize file explorer first
  initFileExplorer();
  
  // Initialize outline panel
  initOutlinePanel();
  
  // Initialize language servers panel

  
  // Then restore last workspace (needs fileExplorer)
  restoreLastWorkspace();
  
  // Initialize diagnostics
  await initDiagnostics();
  
  // Initialize terminal
  await initTerminal();
  
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
    "find-in-project-panel": searchBtn,

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
  const mainRow = document.getElementById("main-row");
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
    mainRow.classList.remove("right-sidebar-visible");
    currentRightPanel = null;
    // Update draggable panes layout
    if (draggablePanes) {
      draggablePanes.updateLayout();
    }
    return;
  }
  
  // A panel is being opened or switched
  sidebar.style.display = "";
  mainRow.classList.add("right-sidebar-visible");
  currentRightPanel = panel;
  
  // Update draggable panes layout
  if (draggablePanes) {
    draggablePanes.updateLayout();
  }

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

function setBottomPanel(panel) {
  const terminalBtn = document.getElementById("terminal-statusbar-button");
  const diagnosticsBtn = document.getElementById("diagnostics-statusbar-button");
  const bottomContainer = document.getElementById("bottom-panels-container");

  const panelMap = {
    "terminal": terminalBtn,
    "diagnostics": diagnosticsBtn
  };

  // Remove highlight from all buttons
  Object.values(panelMap).forEach((btn) => {
    if (btn) btn.classList.remove("active-panel");
  });

  // Hide all bottom panels
  const terminalPanel = document.getElementById("terminal");
  const diagnosticsPanel = document.getElementById("diagnostics");
  if (terminalPanel) terminalPanel.style.display = 'none';
  if (diagnosticsPanel) diagnosticsPanel.style.display = 'none';

  if (currentBottomPanel === panel) {
    // If the same panel is clicked, toggle it off
    currentBottomPanel = null;
    // Hide the entire bottom container when no panels are active
    if (bottomContainer) bottomContainer.style.display = 'none';
    // Update draggable panes layout for terminal
    if (draggablePanes) {
      draggablePanes.updateTerminalLayout();
    }
    return;
  }
  
  // A panel is being opened or switched
  currentBottomPanel = panel;
  // Show the bottom container when a panel is active
  if (bottomContainer) bottomContainer.style.display = '';
  
  // Update draggable panes layout for terminal
  if (draggablePanes) {
    draggablePanes.updateTerminalLayout();
  }

  // Show the correct panel and highlight the button
  const activeBtn = panelMap[panel];
  if (activeBtn) {
    activeBtn.classList.add("active-panel");
  }

  // Show the panel content
  const panelContent = document.getElementById(panel);
  if (panelContent) {
    panelContent.style.display = '';
    
    // Special handling for terminal panel
    if (panel === 'terminal' && terminalInstance) {
      setTimeout(async () => {
        // Create first terminal if none exist
        if (terminalInstance.terminals.size === 0) {
          try {
            const firstTerminalId = await terminalInstance.createNewTerminal();
            if (firstTerminalId) {
              terminalInstance.switchToTerminal(firstTerminalId);
              console.log('First terminal created when panel opened');
            }
          } catch (err) {
            console.error('Failed to create first terminal when opening panel:', err);
          }
        } else {
          terminalInstance.focus();
        }
      }, 100);
    }
    
    // Special handling for diagnostics panel
    if (panel === 'diagnostics' && diagnosticsManager) {
      // Refresh diagnostics when panel is opened
      diagnosticsManager.refresh();
    }
  }
}

// Setup functions
function setupPanelButtons() {
  document.getElementById("project-panel-button").addEventListener("click", () => setLeftPanel("project-panel"));
  document.getElementById("git-panel-button").addEventListener("click", () => setLeftPanel("git-panel"));
  document.getElementById("outline-panel-button").addEventListener("click", () => setLeftPanel("outline-panel"));
  
  document.getElementById("collab-panel-button").addEventListener("click", () => setLeftPanel("collab-panel"));
  document.getElementById("search-project-button").addEventListener("click", () => openSearch());
  document.getElementById("ai-panel-statusbar-button").addEventListener("click", () => setRightPanel("ai-panel"));
  document.getElementById("terminal-statusbar-button").addEventListener("click", () => setBottomPanel("terminal"));
  document.getElementById("diagnostics-statusbar-button").addEventListener("click", () => setBottomPanel("diagnostics"));
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
    

    
    // Clipboard shortcuts - only when file explorer has focus
    const activeElement = document.activeElement;
    const isFileExplorerFocused = activeElement && (
      activeElement.closest('#project-panel') || 
      activeElement.classList.contains('file-item') ||
      activeElement.classList.contains('file-item-content')
    );
    
    if (isFileExplorerFocused && fileExplorer && fileExplorer.selectedFile) {
      // Ctrl/Cmd + C to copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        fileExplorer.copyFileToClipboard(fileExplorer.selectedFile);
      }
      
      // Ctrl/Cmd + X to cut
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        fileExplorer.cutFile(fileExplorer.selectedFile);
      }
      
      // Ctrl/Cmd + V to paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        const parentPath = fileExplorer.selectedFile.substring(0, fileExplorer.selectedFile.lastIndexOf('/')) || fileExplorer.rootFolder;
        fileExplorer.pasteFromClipboard(parentPath);
      }
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
function updateEditor(filePath, content, fileName) {
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
  
  // Set content first
  editorInstance.setContent(content);
  
  // Set current file for language detection (after content is set)
  if (filePath && fileName) {
    const file = {
      name: fileName,
      path: filePath
    };
    editorInstance.setCurrentFile(file);
  }
  
  // Update outline panel with current editor
  if (outlinePanel && editorInstance) {
    outlinePanel.setEditor(editorInstance.editor);
  }
}

// Update tabs function
function updateTabs() {
  const tabsContainer = document.getElementById("editor-tabs-tabs-section");
  tabsContainer.innerHTML = '';
  
  openTabs.forEach(filePath => {
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'untitled';
    
    const tab = document.createElement('div');
    tab.className = 'editor-tab';
    tab.setAttribute('data-filepath', filePath);
    
    if (filePath === currentFilePath) {
      tab.classList.add('active');
    }
    
    const icon = document.createElement('span');
    icon.className = 'tab-icon';
    icon.innerHTML = fileExplorer.getFileIcon(fileName);
    
    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = fileName;
    
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '×';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(filePath);
    });
    
    tab.appendChild(icon);
    tab.appendChild(name);
    tab.appendChild(close);
    
    tab.addEventListener('click', () => {
      switchToTab(filePath);
    });
    
    tabsContainer.appendChild(tab);
  });
}

// Switch to a tab (load file fresh)
async function switchToTab(filePath) {
  try {
    // Handle special case for settings
    if (filePath === 'settings') {
      await openSettings();
      return;
    }
    
    // Load file content fresh from disk
    const content = await window.__TAURI__.core.invoke("read_text_file", { file_path: filePath });
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'untitled';
    
    // Validate content before proceeding
    const validContent = content != null ? String(content) : '';
    
    // Set as current file
    currentFilePath = filePath;
    window.currentFilePath = filePath;
    
    // Update editor with validated content
    updateEditor(filePath, validContent, fileName);
    
    // Update UI
    updateTabs();
    document.getElementById("editor-filename").textContent = fileName;
    
    // Dispatch tab switched event for diagnostics
    document.dispatchEvent(new CustomEvent('tab-switched', {
      detail: { filePath }
    }));
    
  } catch (err) {
    console.error("Failed to switch to tab:", err);
    showNotification('Error loading file', 'error');
    // Remove the tab if it can't be loaded
    openTabs.delete(filePath);
    updateTabs();
  }
}

// Close tab function
function closeTab(filePath) {
  openTabs.delete(filePath);
  
  // If we're closing the current tab, switch to another or show welcome
  if (currentFilePath === filePath) {
    if (openTabs.size > 0) {
      // Switch to the first available tab
      const nextTab = Array.from(openTabs)[0];
      switchToTab(nextTab);
    } else {
      // No tabs left, show welcome screen
      currentFilePath = null;
      if (editorInstance) {
        editorInstance.destroy();
        editorInstance = null;
      }
      
      // Clear outline panel
      if (outlinePanel) {
        outlinePanel.setEditor(null);
      }
      
      const welcomeScreen = document.getElementById("welcome-screen");
      if (welcomeScreen) {
        welcomeScreen.style.display = 'flex';
      }
      
      document.getElementById("editor-filename").textContent = '';
      updateTabs();
    }
  } else {
    // Just update tabs
    updateTabs();
  }
}

// Save current file function
async function saveCurrentFile() {
  if (!currentFilePath) return;
  
  try {
    // Get current content from editor
    if (editorInstance) {
      const content = editorInstance.getContent();
      
      // Special handling for settings file
      if (currentFilePath === 'settings') {
        try {
          // Parse and validate the settings JSON
          const newSettings = JSON.parse(content);
          
          // Update the global settings object
          window.settings = { ...window.settings, ...newSettings };
          
          // Save to the store
          await saveSettings();
          
          // Settings saved silently
          return;
        } catch (parseErr) {
          console.error("Invalid JSON in settings:", parseErr);
          showNotification('Invalid JSON in settings file', 'error');
          return;
        }
      }
      
      // Save regular files directly to disk
      try {
              await window.__TAURI__.core.invoke("write_text_file", { 
        file_path: currentFilePath, 
        content 
      });
        // File saved silently - no notification needed
      } catch (saveErr) {
        console.error("Failed to save file:", saveErr);
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
    const exists = await window.__TAURI__.core.invoke("file_exists", { file_path: filePath });
    
    if (!exists) {
      // File doesn't exist, save default settings
      await saveSettings();
      return;
    }
    
    // Read settings file
    const content = await window.__TAURI__.core.invoke("read_text_file", { file_path: filePath });
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
    await window.__TAURI__.core.invoke("write_text_file", { file_path: filePath, content });
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
}

// Make saveSettings available globally
window.saveSettings = saveSettings;

async function openSettings() {
  try {
    // Ensure settings are loaded
    await loadSettings();
    
    // Create JSON representation of current settings
    const content = JSON.stringify(window.settings, null, 2);
    
    // Add settings tab
    openTabs.add('settings');
    currentFilePath = 'settings';
    
    // Update UI
    updateTabs();
    updateEditor('settings', content, 'settings.json');
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



function openSearch() {
  console.log("Opening search panel");
  const searchInput = document.getElementById("find-in-project-input");
  setLeftPanel("find-in-project-panel");
  initializeFuzzySearch();
  
  // Small delay to ensure panel is visible before focusing
  setTimeout(() => {
    if (searchInput) {
      searchInput.focus();
    }
  }, 100);
}

// Fuzzy search state
let searchState = {
  query: '',
  isRegex: false,
  caseSensitive: false,
  wholeWord: false,
  currentMode: 'files', // 'files' or 'content'
  searchTimeout: null,
  selectedIndex: 0,
  results: [],
  initialized: false
};

function initializeFuzzySearch() {
  // Only initialize once
  if (searchState.initialized) {
    console.log("Search already initialized");
    return;
  }
  
  console.log("Initializing fuzzy search");
  
  // Set up event listeners for search controls
  const searchInput = document.getElementById("find-in-project-input");
  const regexToggle = document.getElementById("search-regex-toggle");
  const caseToggle = document.getElementById("search-case-toggle");
  const wholeWordToggle = document.getElementById("search-whole-word-toggle");
  const filesTab = document.getElementById("search-files-tab");
  const contentTab = document.getElementById("search-content-tab");
  
  console.log("Search elements found:", {
    searchInput: !!searchInput,
    regexToggle: !!regexToggle,
    caseToggle: !!caseToggle,
    wholeWordToggle: !!wholeWordToggle,
    filesTab: !!filesTab,
    contentTab: !!contentTab
  });
  
  if (!searchInput || !regexToggle) {
    console.error("Critical search elements not found");
    return;
  }
  
  // Add input listener with debouncing
  searchInput.addEventListener('input', (e) => {
    searchState.query = e.target.value;
    debouncedSearch();
  });
  
  // Add keyboard navigation
  searchInput.addEventListener('keydown', handleSearchKeyboard);
  
  // Toggle buttons
  regexToggle.addEventListener('click', () => {
    console.log("Regex toggle clicked");
    searchState.isRegex = !searchState.isRegex;
    regexToggle.classList.toggle('active', searchState.isRegex);
    debouncedSearch();
  });
  
  caseToggle.addEventListener('click', () => {
    searchState.caseSensitive = !searchState.caseSensitive;
    caseToggle.classList.toggle('active', searchState.caseSensitive);
    debouncedSearch();
  });
  
  wholeWordToggle.addEventListener('click', () => {
    searchState.wholeWord = !searchState.wholeWord;
    wholeWordToggle.classList.toggle('active', searchState.wholeWord);
    debouncedSearch();
  });
  
  // Tab switching
  filesTab.addEventListener('click', () => {
    console.log("Files tab clicked");
    searchState.currentMode = 'files';
    filesTab.classList.add('active');
    contentTab.classList.remove('active');
    debouncedSearch();
  });
  
  contentTab.addEventListener('click', () => {
    console.log("Content tab clicked");
    searchState.currentMode = 'content';
    filesTab.classList.remove('active');
    contentTab.classList.add('active');
    debouncedSearch();
  });
  
  // Initialize search if there's already a query
  if (searchInput.value) {
    searchState.query = searchInput.value;
    debouncedSearch();
  }
  
  searchState.initialized = true;
}

function debouncedSearch() {
  clearTimeout(searchState.searchTimeout);
  searchState.searchTimeout = setTimeout(() => {
    performSearch();
  }, 300); // 300ms debounce
}

async function performSearch() {
  const query = searchState.query.trim();
  const resultsContainer = document.getElementById("search-results");
  const statusElement = document.getElementById("search-status");
  
  console.log("Performing search for:", query);
  
  if (!query) {
    resultsContainer.innerHTML = '';
    statusElement.textContent = '';
    searchState.results = [];
    return;
  }
  
  if (!fileExplorer || !fileExplorer.rootFolder) {
    console.log("No project opened");
    resultsContainer.innerHTML = '<div class="search-no-results">No project opened</div>';
    statusElement.textContent = '';
    return;
  }
  
  statusElement.textContent = 'Searching...';
  
  try {
    let results = [];
    
    console.log("Search mode:", searchState.currentMode);
    
    if (searchState.currentMode === 'files') {
      console.log("Searching files");
      // Search file names
      results = await searchFiles(query);
    } else {
      console.log("Searching content");
      // Search file contents
      results = await searchFileContents(query);
    }
    
    console.log("Search results:", results);
    
    searchState.results = results;
    searchState.selectedIndex = 0;
    displaySearchResults(results);
    
    const resultCount = results.length;
    statusElement.textContent = resultCount > 0 ? 
      `${resultCount} result${resultCount === 1 ? '' : 's'}` : 
      'No results found';
      
  } catch (error) {
    console.error('Search error:', error);
    resultsContainer.innerHTML = '<div class="search-no-results">Search failed</div>';
    statusElement.textContent = 'Search failed';
  }
}

async function searchFiles(query) {
  // Load workspace files if not already loaded
  if (workspaceFiles.length === 0) {
    workspaceFiles = await getWorkspaceFiles(fileExplorer.rootFolder);
  }
  
  const searchPattern = createSearchPattern(query);
  
  return workspaceFiles
    .filter(file => {
      if (searchState.isRegex) {
        try {
          const regex = new RegExp(searchPattern, searchState.caseSensitive ? 'g' : 'gi');
          return regex.test(file.name) || regex.test(file.relativePath);
        } catch (e) {
          // Invalid regex, fall back to simple search
          return file.name.toLowerCase().includes(query.toLowerCase());
        }
      } else {
        return fuzzyMatch(query, file.name) || fuzzyMatch(query, file.relativePath);
      }
    })
    .sort((a, b) => {
      // Sort by relevance: exact matches first, then fuzzy matches
      const aNameMatch = a.name.toLowerCase().includes(query.toLowerCase());
      const bNameMatch = b.name.toLowerCase().includes(query.toLowerCase());
      
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      
      return a.name.localeCompare(b.name);
    })
    .slice(0, 50) // Limit results for performance
    .map(file => ({
      type: 'file',
      path: file.path,
      name: file.name,
      relativePath: file.relativePath,
      matches: []
    }));
}

async function searchFileContents(query) {
  if (!fileExplorer || !fileExplorer.rootFolder) {
    console.log("No file explorer or root folder for content search");
    return [];
  }
  
  try {
    const searchOptions = {
      useRegex: searchState.isRegex,
      caseSensitive: searchState.caseSensitive,
      wholeWord: searchState.wholeWord,
      maxResults: 100
    };
    
    console.log("Calling searchInFiles with:", {
      workspacePath: fileExplorer.rootFolder,
      query,
      searchOptions
    });
    
    const results = await searchInFiles(fileExplorer.rootFolder, query, searchOptions);
    
    console.log("Raw search results from Tauri:", results);
    
    const mappedResults = results.map(result => ({
      type: 'content',
      path: result.path,
      name: result.name || result.path.split('/').pop(),
      relativePath: result.relativePath || result.path,
      matches: result.matches || []
    }));
    
    console.log("Mapped content search results:", mappedResults);
    return mappedResults;
    
  } catch (error) {
    console.error('Content search error:', error);
    console.error('Error details:', error.message, error.stack);
    // Don't fall back to file search - return empty to debug
    return [];
  }
}

function createSearchPattern(query) {
  if (searchState.isRegex) {
    return query;
  }
  
  // Escape special regex characters for literal search
  let escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  if (searchState.wholeWord) {
    escaped = `\\b${escaped}\\b`;
  }
  
  return escaped;
}

function fuzzyMatch(pattern, text) {
  if (!pattern || !text) return false;
  
  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Simple fuzzy matching algorithm
  let patternIndex = 0;
  let textIndex = 0;
  
  while (patternIndex < patternLower.length && textIndex < textLower.length) {
    if (patternLower[patternIndex] === textLower[textIndex]) {
      patternIndex++;
    }
    textIndex++;
  }
  
  return patternIndex === patternLower.length;
}

function displaySearchResults(results) {
  const resultsContainer = document.getElementById("search-results");
  
  if (!results || results.length === 0) {
    resultsContainer.innerHTML = '<div class="search-no-results">No results found</div>';
    return;
  }
  
  resultsContainer.innerHTML = '';
  
  results.forEach((result, index) => {
    const resultElement = createSearchResultElement(result, index);
    resultsContainer.appendChild(resultElement);
  });
  
  // Select first result
  updateSearchSelection();
}

function createSearchResultElement(result, index) {
  const element = document.createElement('div');
  element.className = 'search-result-item';
  element.dataset.index = index;
  
  const header = document.createElement('div');
  header.className = 'search-result-header';
  
  const icon = document.createElement('div');
  icon.className = 'search-result-icon';
  icon.innerHTML = fileExplorer.getFileIcon(result.name);
  
  const filename = document.createElement('div');
  filename.className = 'search-result-filename';
  filename.textContent = result.name;
  
  const path = document.createElement('div');
  path.className = 'search-result-path';
  path.textContent = result.relativePath;
  
  header.appendChild(icon);
  header.appendChild(filename);
  element.appendChild(header);
  element.appendChild(path);
  
  // Add matches for content search
  if (result.matches && result.matches.length > 0) {
    const matchesContainer = document.createElement('div');
    matchesContainer.className = 'search-result-matches';
    
    result.matches.slice(0, 3).forEach(match => { // Show first 3 matches
      const matchElement = document.createElement('div');
      matchElement.className = 'search-result-match';
      
      const lineNumber = document.createElement('span');
      lineNumber.className = 'search-result-line-number';
      lineNumber.textContent = match.lineNumber;
      
      const matchText = document.createElement('span');
      matchText.className = 'search-result-text';
      matchText.innerHTML = highlightMatch(match.text, searchState.query);
      
      matchElement.appendChild(lineNumber);
      matchElement.appendChild(matchText);
      matchesContainer.appendChild(matchElement);
    });
    
    element.appendChild(matchesContainer);
  }
  
  element.addEventListener('click', () => openSearchResult(result));
  
  return element;
}

function highlightMatch(text, query) {
  if (!query || searchState.isRegex) {
    try {
      const regex = new RegExp(`(${createSearchPattern(query)})`, searchState.caseSensitive ? 'g' : 'gi');
      return text.replace(regex, '<span class="search-highlight">$1</span>');
    } catch (e) {
      return text;
    }
  }
  
  // Simple highlighting for non-regex search
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, searchState.caseSensitive ? 'g' : 'gi');
  return text.replace(regex, '<span class="search-highlight">$1</span>');
}

function handleSearchKeyboard(e) {
  const results = searchState.results;
  if (!results || results.length === 0) return;
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      searchState.selectedIndex = Math.min(searchState.selectedIndex + 1, results.length - 1);
      updateSearchSelection();
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      searchState.selectedIndex = Math.max(searchState.selectedIndex - 1, 0);
      updateSearchSelection();
      break;
      
    case 'Enter':
      e.preventDefault();
      if (results[searchState.selectedIndex]) {
        openSearchResult(results[searchState.selectedIndex]);
      }
      break;
      
    case 'Escape':
      e.preventDefault();
      setLeftPanel(null);
      break;
  }
}

function updateSearchSelection() {
  const resultElements = document.querySelectorAll('.search-result-item');
  resultElements.forEach((el, index) => {
    el.classList.toggle('selected', index === searchState.selectedIndex);
  });
  
  // Scroll selected item into view
  const selectedElement = resultElements[searchState.selectedIndex];
  if (selectedElement) {
    selectedElement.scrollIntoView({ block: 'nearest' });
  }
}

async function openSearchResult(result) {
  try {
    await fileExplorer.openFileByPath(result.path);
    
    // If it's a content search result with matches, navigate to first match
    if (result.matches && result.matches.length > 0 && editorInstance) {
      const firstMatch = result.matches[0];
      setTimeout(() => {
        editorInstance.editor?.setPosition({
          lineNumber: firstMatch.lineNumber,
          column: firstMatch.column || 1
        });
        editorInstance.editor?.revealLineInCenter(firstMatch.lineNumber);
      }, 100);
    }
  } catch (error) {
    console.error('Failed to open search result:', error);
    showNotification('Failed to open file', 'error');
  }
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
    const { path, name, content } = e.detail;
    
    // Add to open tabs
    openTabs.add(path);
    
    // Set as current file
    currentFilePath = path;
    window.currentFilePath = path;
    
    // Validate content before passing to editor
    const validContent = content != null ? String(content) : '';
    
    // Update UI
    updateTabs();
    updateEditor(path, validContent, name);
    
    // Update filename in toolbar
    document.getElementById("editor-filename").textContent = name;
  });
  
  // Set up event listener for no file selected
  document.addEventListener('no-file-selected', () => {
    currentFilePath = null;
    window.currentFilePath = null;
    
    // Destroy editor instance and show welcome screen
    if (editorInstance) {
      editorInstance.destroy();
      editorInstance = null;
    }
    
    // Clear outline panel
    if (outlinePanel) {
      outlinePanel.setEditor(null);
    }
    
    // Show welcome screen
    const welcomeScreen = document.getElementById("welcome-screen");
    if (welcomeScreen) {
      welcomeScreen.style.display = 'flex';
    }
    
    document.getElementById("editor-filename").textContent = '';
    updateTabs();
  });
  
  // Set up event listener for file closed (from file explorer)
  document.addEventListener('file-closed', (e) => {
    const { path } = e.detail;
    
    // Remove from open tabs and handle cleanup
    closeTab(path);
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

// Initialize outline panel
function initOutlinePanel() {
  // Create outline panel instance
  outlinePanel = new OutlinePanel();
}

// Initialize language servers panel


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
async function initTerminal() {
  try {
    terminalInstance = new TerminalManager();
    
    // Set working directory when project is opened
    document.addEventListener('folder-opened', (e) => {
      if (terminalInstance && e.detail.path) {
        terminalInstance.setWorkingDirectory(e.detail.path);
      }
    });
  } catch (err) {
    console.error('Failed to initialize terminal:', err);
  }
}

// Initialize diagnostics system
async function initDiagnostics() {
  try {
    // Initialize diagnostics manager, passing the file explorer instance
    diagnosticsManager = new DiagnosticsManager(fileExplorer);
    
    // Make manager globally available
    window.diagnosticsManager = diagnosticsManager;
    
    // Set up refresh button event listener
    const refreshBtn = document.getElementById('diagnostics-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (diagnosticsManager) {
          diagnosticsManager.forceRefresh();
        }
      });
    }

    // Set up debug toggle button
    const debugBtn = document.getElementById('diagnostics-debug-btn');
    if (debugBtn) {
      debugBtn.addEventListener('click', () => {
        if (diagnosticsManager) {
          diagnosticsManager.toggleDebugMode();
        }
      });
    }

    // Set up test button
    const testBtn = document.getElementById('diagnostics-test-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        if (diagnosticsManager) {
          diagnosticsManager.testWithSampleDiagnostics();
        }
      });
    }

    // Set up open test file button
    const openTestFileBtn = document.getElementById('diagnostics-open-test-file-btn');
    if (openTestFileBtn) {
      openTestFileBtn.addEventListener('click', async () => {
        try {
          if (fileExplorer && fileExplorer.rootFolder) {
            // Create test file path in the current workspace
            const testFilePath = `${fileExplorer.rootFolder}/src/test-diagnostics.js`;
            console.log('Attempting to open test file at:', testFilePath);
            
            // Try to open the file first
            try {
              await fileExplorer.openFileByPath(testFilePath);
              console.log('Opened existing test file:', testFilePath);
            } catch (error) {
              console.log('Test file does not exist, creating it:', error.message);
              
              // Create the test file content
              const testContent = `// Test file for diagnostics
console.log("This should trigger a warning");
debugger; // This should trigger a warning

var oldStyle = "this should suggest let/const"; // This should trigger an info message

// TODO: This is a test todo comment
// FIXME: This needs to be fixed

function testFunction() {
    let x = 5
    let y = 10 // Missing semicolon
    
    if (x == y) { // Should suggest ===
        return x + y
    }
    
    return false; // This line is fine
}

let unused = "this variable might be unused"; // Might trigger unused warning

console.warn("Another console statement");
console.error("Error console statement");

// This function has issues
function problemFunction() {
    var problem = "another var usage"
    return problem
}`;

              // Write the test file
              await writeTextFile(testFilePath, testContent);
              
              // Open the newly created file
              await fileExplorer.openFileByPath(testFilePath);
              console.log('Created and opened test file:', testFilePath);
            }
            
            // Refresh diagnostics after opening the file
            setTimeout(() => {
              if (diagnosticsManager) {
                diagnosticsManager.refresh();
              }
            }, 100);
          } else {
            console.error('File explorer not available or no workspace open');
            alert('Please open a workspace folder first');
          }
        } catch (error) {
          console.error('Failed to open/create test file:', error);
          alert('Failed to open/create test file: ' + error.message);
        }
      });
    }
    
    // Set up integration with file system events
    document.addEventListener('folder-opened', (e) => {
      if (diagnosticsManager && e.detail.path) {
        // Refresh diagnostics when a new project is opened
        setTimeout(() => {
          diagnosticsManager.refresh();
        }, 1000); // Small delay to let file system settle
      }
    });

    // Refresh diagnostics when files are opened
    document.addEventListener('file-opened', (e) => {
      if (diagnosticsManager && e.detail.path) {
        // Small delay to let file system settle
        setTimeout(() => {
          diagnosticsManager.refresh(e.detail.path);
        }, 100); // Reduced delay for faster response
      }
    });

    // Refresh diagnostics when current file changes
    document.addEventListener('no-file-selected', () => {
      if (diagnosticsManager) {
        diagnosticsManager.refresh(null);
      }
    });
    
    console.log('Diagnostics initialized');
  } catch (err) {
    console.error('Failed to initialize diagnostics:', err);
  }
}

// Initialize settings watcher
function initSettingsWatcher() {
  // Check for settings changes every 2 seconds
  settingsWatcher = setInterval(async () => {
    try {
      const filePath = await getSettingsFilePath();
      const exists = await window.__TAURI__.core.invoke("file_exists", { file_path: filePath });
      
      if (exists) {
        const content = await window.__TAURI__.core.invoke("read_text_file", { file_path: filePath });
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
  
  // Apply terminal settings changes
  if (JSON.stringify(oldSettings.terminal) !== JSON.stringify(newSettings.terminal) && terminalInstance) {
    terminalInstance.updateSettings();
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
  // Add a small delay to ensure DOM is fully ready
  setTimeout(() => {
    draggablePanes = new DraggablePanes();
    
    // Ensure initial layout is set correctly
    draggablePanes.updateLayout();
    
    // Add reset pane sizes command
    availableCommands.push({
      id: 'reset-pane-sizes', 
      name: 'Reset Pane Sizes', 
      action: () => draggablePanes.resetPaneSizes()
    });
  }, 100);
}