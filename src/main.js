// Import Tauri APIs
const { invoke } = window.__TAURI__.core;
const { open, save } = window.__TAURI__.dialog;
const { readTextFile, writeTextFile, readDir, createDir, removeFile } = window.__TAURI__.fs;
const { appWindow } = window.__TAURI__.window;

// Import our modules
import FileExplorer from './file-explorer.js';
import Editor from './editor.js';

// Global state
let currentLeftPanel = "project-panel"; // Default to project panel open
let currentRightPanel = null;
let settings = {
  theme: "dark",
  fontSize: 14,
  tabSize: 2,
  icons: {
    file: "📄",
    folder: "📁",
    javascript: "📜",
    html: "🌐",
    css: "🎨",
    json: "🔧",
    markdown: "📝"
  }
};
let openedFiles = [];
let currentFile = null;
let fileExplorer = null;

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
  // Open project button is handled in initFileExplorer
  document.getElementById("search-tool-button").addEventListener("click", openSearch);
  document.getElementById("settings-tool-button").addEventListener("click", openSettings);
}

function setupWindowControls() {
  // Window control buttons (minimize, maximize, close)
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

// File system functions
async function openProject() {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Project Folder"
    });
    
    if (selected) {
      loadProjectFiles(selected);
    }
  } catch (err) {
    console.error("Failed to open project:", err);
  }
}

async function loadProjectFiles(folderPath) {
  try {
    const entries = await readDir(folderPath, { recursive: true });
    renderFileTree(entries, document.querySelector("#project-panel .sidebar-panel-content"));
    
    // Show project panel if not already visible
    setLeftPanel("project-panel");
    
    // Save last opened project
    settings.lastProject = folderPath;
    saveSettings();
  } catch (err) {
    console.error("Failed to load project files:", err);
  }
}

function renderFileTree(entries, container) {
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
    const li = document.createElement('li');
    
    // Create item with icon
    const item = document.createElement('div');
    item.className = 'file-item';
    
    // Add icon based on file type
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    
    if (entry.children) {
      // It's a directory
      icon.textContent = settings.icons.folder;
      item.classList.add('folder');
      
      // Add click handler to toggle folder
      item.addEventListener('click', () => {
        li.classList.toggle('expanded');
      });
      
      // Add children
      if (entry.children.length > 0) {
        const childUl = document.createElement('ul');
        childUl.className = 'file-tree';
        
        // Recursively render children
        entry.children.forEach(child => {
          const childLi = createFileTreeItem(child);
          childUl.appendChild(childLi);
        });
        
        li.appendChild(childUl);
      }
    } else {
      // It's a file
      icon.textContent = getFileIcon(entry.name);
      item.classList.add('file');
      
      // Add click handler to open file
      item.addEventListener('click', () => {
        openFile(entry.path);
      });
    }
    
    // Add name
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = entry.name;
    
    item.appendChild(icon);
    item.appendChild(name);
    li.appendChild(item);
    
    ul.appendChild(li);
  });
  
  container.appendChild(ul);
}

function createFileTreeItem(entry) {
  const li = document.createElement('li');
  
  // Create item with icon
  const item = document.createElement('div');
  item.className = 'file-item';
  
  // Add icon based on file type
  const icon = document.createElement('span');
  icon.className = 'file-icon';
  
  if (entry.children) {
    // It's a directory
    icon.textContent = settings.icons.folder;
    item.classList.add('folder');
    
    // Add click handler to toggle folder
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      li.classList.toggle('expanded');
    });
    
    // Add children
    if (entry.children.length > 0) {
      const childUl = document.createElement('ul');
      childUl.className = 'file-tree';
      
      // Recursively render children
      entry.children.forEach(child => {
        const childLi = createFileTreeItem(child);
        childUl.appendChild(childLi);
      });
      
      li.appendChild(childUl);
    }
  } else {
    // It's a file
    icon.textContent = getFileIcon(entry.name);
    item.classList.add('file');
    
    // Add click handler to open file
    item.addEventListener('click', () => {
      openFile(entry.path);
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

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  
  switch (ext) {
    case 'js':
      return settings.icons.javascript;
    case 'html':
      return settings.icons.html;
    case 'css':
      return settings.icons.css;
    case 'json':
      return settings.icons.json;
    case 'md':
      return settings.icons.markdown;
    default:
      return settings.icons.file;
  }
}

async function openFile(path) {
  try {
    const content = await readTextFile(path);
    const filename = path.split('/').pop();
    
    // Check if file is already open
    const existingTab = openedFiles.find(file => file.path === path);
    
    if (!existingTab) {
      // Add to opened files
      openedFiles.push({
        path,
        filename,
        content
      });
    }
    
    // Set as current file
    currentFile = path;
    
    // Update UI
    updateTabs();
    updateEditor(content);
    
    // Update filename in toolbar
    document.getElementById("editor-filename").textContent = filename;
  } catch (err) {
    console.error("Failed to open file:", err);
  }
}

function updateTabs() {
  const tabsContainer = document.getElementById("editor-tabs-tabs-section");
  tabsContainer.innerHTML = '';
  
  openedFiles.forEach(file => {
    const tab = document.createElement('div');
    tab.className = 'editor-tab';
    if (file.path === currentFile) {
      tab.classList.add('active');
    }
    
    const icon = document.createElement('span');
    icon.className = 'tab-icon';
    icon.textContent = getFileIcon(file.filename);
    
    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = file.filename;
    
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '×';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(file.path);
    });
    
    tab.appendChild(icon);
    tab.appendChild(name);
    tab.appendChild(close);
    
    tab.addEventListener('click', () => {
      currentFile = file.path;
      updateTabs();
      updateEditor(file.content);
    });
    
    tabsContainer.appendChild(tab);
  });
}

function closeTab(path) {
  const index = openedFiles.findIndex(file => file.path === path);
  
  if (index !== -1) {
    openedFiles.splice(index, 1);
    
    // If we closed the current file, switch to another tab
    if (path === currentFile) {
      if (openedFiles.length > 0) {
        currentFile = openedFiles[Math.max(0, index - 1)].path;
        updateEditor(openedFiles.find(file => file.path === currentFile).content);
      } else {
        currentFile = null;
        updateEditor('');
        document.getElementById("editor-filename").textContent = '';
      }
    }
    
    updateTabs();
  }
}

let editorInstance = null;

function updateEditor(content) {
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
  if (currentFile) {
    const file = openedFiles.find(file => file.path === currentFile);
    if (file) {
      editorInstance.setCurrentFile(file);
    }
  }
}

async function saveCurrentFile() {
  if (!currentFile) return;
  
  const file = openedFiles.find(file => file.path === currentFile);
  if (file) {
    try {
      // Get current content from editor
      if (editorInstance) {
        file.content = editorInstance.getContent();
      }
      
      // Save using file explorer
      const success = await fileExplorer.saveFile(file.path, file.content);
      
      if (success) {
        showNotification('File saved');
      } else {
        showNotification('Error saving file', 'error');
      }
    } catch (err) {
      console.error("Failed to save file:", err);
      showNotification('Error saving file', 'error');
    }
  }
}

// Settings management
async function loadSettings() {
  try {
    // Try to load settings from file
    const content = await readTextFile('settings.json');
    const loadedSettings = JSON.parse(content);
    settings = { ...settings, ...loadedSettings };
  } catch (err) {
    // If settings file doesn't exist, create it
    saveSettings();
  }
}

async function saveSettings() {
  try {
    await writeTextFile('settings.json', JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
}

async function openSettings() {
  try {
    // Create settings file if it doesn't exist
    try {
      await readTextFile('settings.json');
    } catch (err) {
      await writeTextFile('settings.json', JSON.stringify(settings, null, 2));
    }
    
    // Open settings file in editor
    await openFile('settings.json');
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
    const { path, filename, content } = e.detail;
    
    // Check if file is already open
    const existingTab = openedFiles.find(file => file.path === path);
    
    if (!existingTab) {
      // Add to opened files
      openedFiles.push({
        path,
        filename,
        content
      });
    }
    
    // Set as current file
    currentFile = path;
    
    // Update UI
    updateTabs();
    updateEditor(content);
    
    // Update filename in toolbar
    document.getElementById("editor-filename").textContent = filename;
  });
  
  // Set up event listener for no file selected
  document.addEventListener('no-file-selected', () => {
    currentFile = null;
    updateEditor('');
    document.getElementById("editor-filename").textContent = '';
    updateTabs();
  });
  
  // If we have a last opened project, load it
  if (settings.lastProject) {
    fileExplorer.rootFolder = settings.lastProject;
    fileExplorer.refreshFileTree();
  }
  
  // Update open project button to use file explorer
  document.getElementById("open-project-button").addEventListener("click", async () => {
    const opened = await fileExplorer.openFolder();
    if (opened) {
      // Save last opened project
      settings.lastProject = fileExplorer.rootFolder;
      saveSettings();
      
      // Show project panel
      setLeftPanel("project-panel");
    }
  });
}
