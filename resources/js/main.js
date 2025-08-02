console.log("main.js loaded: script is running");
console.log("DOMContentLoaded fired");
Neutralino.init();

let currentLeftPanel = "project-panel"; // Default to project panel open

window.setLeftPanel = function(panel) {
  const sidebar = document.getElementById("sidebar-left");
  const projectBtn = document.getElementById("project-panel-button");
  const gitBtn = document.getElementById("git-panel-button");
  const outlineBtn = document.getElementById("outline-panel-button");
  const collabBtn = document.getElementById("collab-panel-button");
  const searchBtn = document.getElementById("search-project-button");
const newPanelBtn = document.getElementById("new-panel-button");

  const panelMap = {
    "project-panel": projectBtn,
    "git-panel": gitBtn,
    "outline-panel": outlineBtn,
    "collab-panel": collabBtn,
    "find-in-project-panel": searchBtn,
"new-panel": newPanelBtn,
  };

  // Remove highlight from all buttons
  Object.values(panelMap).forEach((btn) => {
    if (btn) btn.classList.remove("active-panel");
  });

  // Hide all panels
  const panels = sidebar.querySelectorAll(".sidebar-panel-content");
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

      if (window.fileExplorer) {
        const fileList = sidebar.querySelector("#file-list");
        if (panel === "project-panel") {
            if (fileList) {
                fileList.style.display = '';
            } else {
                window.fileExplorer.loadCurrentDirectory();
            }
        } else {
            if (fileList) {
                fileList.style.display = 'none';
            }
        }
    }

    // Handle panel-specific logic
    switch (panel) {
        case "project-panel":
            // Already handled above
            break;
        case "git-panel":
        case "outline-panel":
        case "collab-panel":
        case "find-in-project-panel":
        case "new-panel":
            const panelContent = sidebar.querySelector(`#${panel}`);
            if(panelContent) {
                panelContent.style.display = '';
                // Show Coming Soon message if panel is empty
                const content = panelContent.querySelector('.sidebar-panel-content');
                if (content) {
                    content.style.display = '';
                    if (!content.innerHTML.trim() || content.innerHTML.trim() === panel) {
                        content.innerHTML = `${panel.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} (Coming Soon)`;
                    }
                }
            }
            break;
        default:
            sidebar.style.display = 'none';
            currentLeftPanel = null;
            break;
    }
    
    // Update button states
    Object.entries(panelMap).forEach(([key, btn]) => {
        if (btn) {
            if (key === panel) {
                btn.classList.add("active-panel");
                // Show tooltip on hover
                btn.title = key === "project-panel" ? "Project Explorer" : 
                           `${key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} (Coming Soon)`;
            } else {
                btn.classList.remove("active-panel");
            }
        }
    });
}

let currentRightPanel = null;

function setRightPanel(panel) {
  const sidebar = document.getElementById("sidebar-right");
  const aiPanelBtn = document.getElementById("ai-panel-statusbar-button");

  // Remove highlight from all
  [aiPanelBtn].forEach((btn) => {
    if (btn) {
      btn.classList.remove("active-panel");
      btn.title = "AI Panel (Coming Soon)";
    }
  });

  // Hide all panels
  const panels = sidebar.querySelectorAll(".sidebar-panel-content");
  panels.forEach(p => p.style.display = 'none');

  if (currentRightPanel === panel) {
    // Close if already open
    sidebar.style.display = "none";
    currentRightPanel = null;
    if (aiPanelBtn) aiPanelBtn.classList.remove("active-panel");
    return;
  }

  // Show sidebar and highlight the active button
  sidebar.style.display = "";
  switch (panel) {
    case "ai-panel":
      if (aiPanelBtn) {
        aiPanelBtn.classList.add("active-panel");
        aiPanelBtn.title = "AI Panel (Coming Soon)";
      }
      const aiPanel = sidebar.querySelector("#ai-panel");
      if (aiPanel) {
        aiPanel.style.display = '';
        // Show Coming Soon message if panel is empty
        const content = aiPanel.querySelector('.sidebar-panel-content');
        if (content) {
          content.style.display = '';
          content.innerHTML = 'AI Panel (Coming Soon)';
          content.style.padding = '20px';
          content.style.textAlign = 'center';
          content.style.color = '#888aad';
          content.style.fontSize = '14px';
        }
      }
      break;
    default:
      sidebar.style.display = "none";
      currentRightPanel = null;
      break;
  }
  currentRightPanel = panel;
}

Neutralino.events.on("windowClose", () => {
  Neutralino.app.exit();
});

// Hide terminal and left sidebar by default
const terminal = document.getElementById("terminal");
const sidebarLeft = document.getElementById("sidebar-left");
console.log("Found terminal:", !!terminal, "Found sidebarLeft:", !!sidebarLeft);
if (terminal) terminal.style.display = "none";
if (sidebarLeft) sidebarLeft.style.display = "none";

// --- Draggable Splitter Logic ---

function addSidebarEditorSplitter() {
  const sidebar = document.getElementById("sidebar-left");
  const mainRow = document.getElementById("main-row");
  if (!sidebar || !mainRow) return;
  let splitter = document.getElementById("sidebar-editor-splitter");
  if (!splitter) {
    splitter = document.createElement("div");
    splitter.id = "sidebar-editor-splitter";
    mainRow.insertBefore(splitter, sidebar.nextSibling);
  }
  let dragging = false;
  splitter.addEventListener("mousedown", (e) => {
    dragging = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const minWidth = 120;
    const maxWidth = 600;
    let newWidth = e.clientX;
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    sidebar.style.width = newWidth + "px";
  });
  document.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}

function addEditorTerminalSplitter() {
  const editorArea = document.getElementById("editor-area");
  const terminal = document.getElementById("terminal");
  const main = document.getElementById("main");
  if (!editorArea || !terminal || !main) return;
  let splitter = document.getElementById("editor-terminal-splitter");
  if (!splitter) {
    splitter = document.createElement("div");
    splitter.id = "editor-terminal-splitter";
    main.insertBefore(splitter, terminal);
  }
  let dragging = false;
  splitter.addEventListener("mousedown", (e) => {
    dragging = true;
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const mainRect = main.getBoundingClientRect();
    const minHeight = 80;
    const maxHeight = mainRect.height - 80;
    let newHeight = e.clientY - mainRect.top;
    if (newHeight < minHeight) newHeight = minHeight;
    if (newHeight > maxHeight) newHeight = maxHeight;
    editorArea.style.flex = "none";
    editorArea.style.height = newHeight + "px";
    terminal.style.height =
      mainRect.height - newHeight - splitter.offsetHeight + "px";
  });
  document.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}

// Define openProject globally before anything else needs it
window.openProject = async function openProject() {
  console.log("openProject called");
  let folder = await Neutralino.os.showFolderDialog("Select a folder");
  if (folder) {
    console.log("Folder selected:", folder);

    // Wait for window.fileExplorer to be ready
    async function tryAddRootFolder(retries = 10) {
      if (
        window.fileExplorer &&
        typeof window.fileExplorer.addRootFolder === "function"
      ) {
        document.getElementById("welcome-screen").style.display = "none";
        await window.fileExplorer.addRootFolder(folder);
      } else if (retries > 0) {
        setTimeout(() => tryAddRootFolder(retries - 1), 100);
      } else {
        console.error("FileExplorer not ready after waiting.");
      }
    }
    await tryAddRootFolder();
  } else {
    console.log("No folder selected");
  }
};

function showNotification(options) {
    let { message, type = 'info', duration = 5000, buttons = [], onClick, isJson = false } = options;

    if (typeof message === 'object' && message !== null) {
        message = JSON.stringify(message, null, 4);
        isJson = true;
    }
    
    const container = document.getElementById('notification-previews');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'notification-message';

    if (isJson) {
        try {
            const jsonObj = JSON.parse(message);
            messageDiv.textContent = JSON.stringify(jsonObj, null, 4);
            messageDiv.style.whiteSpace = 'pre-wrap';
        } catch (e) {
            messageDiv.textContent = message; // Fallback to raw text
        }
    } else {
        messageDiv.textContent = message;
    }

    notification.appendChild(messageDiv);

    if (onClick) {
        notification.addEventListener('click', onClick);
        notification.style.cursor = 'pointer';
    }
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'notification-actions';

    if (buttons.length > 0) {
        buttons.forEach(btnOptions => {
            const button = document.createElement('button');
            button.textContent = btnOptions.text;
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent notification's onClick from firing
                btnOptions.action();
                notification.remove();
            });
            actionsDiv.appendChild(button);
        });
    }

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.className = 'close-btn';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notification.remove();
    });
    actionsDiv.appendChild(closeBtn);
    
    notification.appendChild(actionsDiv);
    container.appendChild(notification);

    if (duration > 0) {
        setTimeout(() => {
            notification.remove();
        }, duration);
    }
}

async function main() {
  window.settings = new Settings();
  await window.settings.load();

  // Dynamically import the modular FileExplorer class and only proceed once loaded
  const { default: FileExplorer } = await import(
    "./file-explorer/FileExplorer.js"
  );
  window.fileExplorer = new FileExplorer();
  window.commandPalette = new CommandPalette();

  // Define openProject globally after FileExplorer is ready
  window.openProject = async function openProject() {
    console.log("openProject called");
    let folder = await Neutralino.os.showFolderDialog("Select a folder");
    if (folder) {
      console.log("Folder selected:", folder);
      window.fileExplorer.addRootFolder(folder);
      document.getElementById("welcome-screen").style.display = "none";
      // Ensure the project panel is active
      setLeftPanel("project-panel");
    } else {
      console.log("No folder selected");
    }
  };

  // Add draggable splitters
  addSidebarEditorSplitter();
  addEditorTerminalSplitter();

  // Panel button logic
  const projectBtn = document.getElementById("project-panel-button");
  const gitBtn = document.getElementById("git-panel-button");
  const outlineBtn = document.getElementById("outline-panel-button");
  const collabBtn = document.getElementById("collab-panel-button");
  const searchBtn = document.getElementById("search-project-button");
const newPanelBtn = document.getElementById("new-panel-button");
  const findInProjectInput = document.getElementById("find-in-project-input");
  const aiPanelBtn = document.getElementById("ai-panel-statusbar-button");

  if (projectBtn) {
    projectBtn.addEventListener("click", () => setLeftPanel("project-panel"));
  }
  if (gitBtn) {
    gitBtn.addEventListener("click", () => setLeftPanel("git-panel"));
  }
  if (outlineBtn) {
    outlineBtn.addEventListener("click", () => setLeftPanel("outline-panel"));
  }
  if (collabBtn) {
    collabBtn.addEventListener("click", () => setLeftPanel("collab-panel"));
  }
  if (searchBtn) {
    searchBtn.addEventListener("click", () => setLeftPanel("find-in-project-panel"));
}
if (newPanelBtn) {
    newPanelBtn.addEventListener("click", () => setLeftPanel("new-panel"));
}
  if(findInProjectInput) {
    findInProjectInput.addEventListener("input", (e) => {
      if (window.fileExplorer) {
        window.fileExplorer.findInProject(e.target.value);
      }
    });
  }
  if (aiPanelBtn) {
    aiPanelBtn.addEventListener("click", () => setRightPanel("ai-panel"));
  }

  // Set default panel state and highlight on startup
  setLeftPanel("project-panel");

  // Toggle terminal on statusbar button click
  const terminalBtn = document.getElementById("terminal-statusbar-button");
  if (terminalBtn && terminal) {
    console.log("Attaching terminal toggle listener");
    terminalBtn.addEventListener("click", () => {
      console.log("Terminal statusbar button clicked");
      if (terminal.style.display === "none" || terminal.style.display === "") {
        terminal.style.display = "flex";
      } else {
        terminal.style.display = "none";
      }
    });
  } else {
    console.log("No terminal/statusbar button found");
  }

  const openProjectBtn = document.getElementById("open-project-button");
  if (openProjectBtn) {
    console.log("Attaching open project button listener");
    openProjectBtn.addEventListener("click", () => {
      console.log("Open project button clicked");
      window.openProject();
    });
  } else {
    console.log("Open project button not found");
  }
}

main();
console.log("main() called");

window.addEventListener('error', function(event) {
    showNotification({
        message: event.message,
        type: 'error',
        duration: 10000
    });
});