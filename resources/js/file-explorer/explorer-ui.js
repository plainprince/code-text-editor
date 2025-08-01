/**
 * explorer-ui.js
 * UI rendering and DOM manipulation for the File Explorer.
 *
 * Exports functions for rendering file/folder lists, updating the sidebar,
 * and handling UI-specific updates.
 */

function createFileIcon(entry, config, isOpen = false) {
  // Use SVG icons from config
  if (!config || !config.icons) return "";
  if (entry.type === "DIRECTORY") {
    if (isOpen && config.icons["folder-open"]) {
      return `<span class="file-icon" aria-label="folder" style="margin-right:8px;">${config.icons["folder-open"]}</span>`;
    }
    return `<span class="file-icon" aria-label="folder" style="margin-right:8px;">${config.icons.folder || ""}</span>`;
  } else {
    // Try to use extension-specific icon, fallback to generic file
    const ext = entry.name && entry.name.split(".").pop();
    if (ext && config.icons[ext]) {
      return `<span class="file-icon" aria-label="file" style="margin-right:8px;">${config.icons[ext]}</span>`;
    }
    return `<span class="file-icon" aria-label="file" style="margin-right:8px;">${config.icons.file || ""}</span>`;
  }
}

// Helper to show context menu (modular, calls explorer-contextmenu.js)
function showContextMenuForEntry(e, entry, fileExplorerInstance) {
  if (
    fileExplorerInstance &&
    typeof fileExplorerInstance.showContextMenu === "function"
  ) {
    e.preventDefault();
    fileExplorerInstance.showContextMenu(e, {
      path: entry.fullPath || entry.absPath,
      type: entry.type,
      name: entry.name,
      entry: entry,
    });
  }
}

function updateSelection(fileExplorerInstance, path, ctrlKey, shiftKey) {
  const allItems = Array.from(document.querySelectorAll('.file-item, .folder-header'));
  const clickedIndex = allItems.findIndex(item => item.dataset.path === path);

  if (!shiftKey) {
    if (ctrlKey) {
      if (fileExplorerInstance.selectedItems.includes(path)) {
        fileExplorerInstance.selectedItems = fileExplorerInstance.selectedItems.filter(p => p !== path);
      } else {
        fileExplorerInstance.selectedItems.push(path);
      }
    } else {
      fileExplorerInstance.selectedItems = [path];
    }
    fileExplorerInstance.lastSelectedIndex = clickedIndex;
  } else {
    const lastIndex = fileExplorerInstance.lastSelectedIndex;
    const start = Math.min(lastIndex, clickedIndex);
    const end = Math.max(lastIndex, clickedIndex);
    const selectedPaths = allItems.slice(start, end + 1).map(item => item.dataset.path);
    if (ctrlKey) {
      selectedPaths.forEach(p => {
        if (!fileExplorerInstance.selectedItems.includes(p)) {
          fileExplorerInstance.selectedItems.push(p);
        }
      });
    } else {
      fileExplorerInstance.selectedItems = selectedPaths;
    }
  }

  allItems.forEach(item => {
    if (fileExplorerInstance.selectedItems.includes(item.dataset.path)) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

function createFileItem(entry, parentPath, fileExplorerInstance, config) {
    const item = document.createElement("div");
    item.className = "file-item";
    item.draggable = true;
    item.dataset.path = `${parentPath}/${entry.name}`;
    item.dataset.type = entry.type;
    item.dataset.name = entry.name;
    item.innerHTML = `
        ${createFileIcon(entry, config)}
        <div class="file-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            <p style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${entry.name}</p>
        </div>
    `;
    // Click to select/open
    item.addEventListener("click", (e) => {
        updateSelection(fileExplorerInstance, item.dataset.path, e.ctrlKey || e.metaKey, e.shiftKey);
    });
    // Double click to open
    item.addEventListener("dblclick", (e) => {
        if (
            fileExplorerInstance &&
            typeof fileExplorerInstance.openFileInEditor === "function"
        ) {
            fileExplorerInstance.openFileInEditor(item.dataset.path);
        }
    });
    // Right-click context menu
    item.addEventListener("contextmenu", (e) => {
        showContextMenuForEntry(e, entry, fileExplorerInstance);
    });

    item.addEventListener('mouseenter', (e) => {
        fileExplorerInstance.startTooltipTimer(e, item.dataset.path);
    });

    item.addEventListener('mouseleave', () => {
        fileExplorerInstance.clearTooltipTimer();
    });

    return item;
}

function createFolderDiv(
  entry,
  parentPath,
  fileExplorerInstance,
  config,
  isRoot = false,
  open = false,
) {
  const folderDiv = document.createElement("div");
  folderDiv.className = "file-folder";
  folderDiv.draggable = true;
  const folderPath = isRoot
    ? entry.fullPath || entry.name
    : `${parentPath}/${entry.name}`;
  folderDiv.dataset.path = folderPath;
  folderDiv.dataset.type = "DIRECTORY";
  folderDiv.dataset.name = entry.name;

  // Track open/closed state in explorer instance
  if (!fileExplorerInstance._openFolders)
    fileExplorerInstance._openFolders = {};
  if (typeof fileExplorerInstance._openFolders[folderPath] === "undefined") {
    fileExplorerInstance._openFolders[folderPath] = isRoot ? true : false;
  }

  // Folder header
  const headerDiv = document.createElement("div");
  headerDiv.className = "folder-header";
  headerDiv.dataset.path = folderPath;
  headerDiv.innerHTML = `
        ${createFileIcon(entry, config, fileExplorerInstance._openFolders[folderPath])}
        <div class="file-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            <p style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${entry.name}</p>
        </div>
    `;
  // Toggle open/close on header click
headerDiv.addEventListener("click", (e) => {
    if (e.detail === 1) { // single click
        updateSelection(fileExplorerInstance, headerDiv.dataset.path, e.ctrlKey || e.metaKey, e.shiftKey);
    }
});
headerDiv.addEventListener("dblclick", (e) => {
    fileExplorerInstance.toggleFolder(folderPath);
});
  // Right-click context menu for folders
  headerDiv.addEventListener("contextmenu", (e) => {
    showContextMenuForEntry(e, entry, fileExplorerInstance);
  });

    headerDiv.addEventListener('mouseenter', (e) => {
        fileExplorerInstance.startTooltipTimer(e, headerDiv.dataset.path);
    });

    headerDiv.addEventListener('mouseleave', () => {
        fileExplorerInstance.clearTooltipTimer();
    });

  folderDiv.appendChild(headerDiv);

  // Children (recursive, only if open)
  if (
    fileExplorerInstance._openFolders[folderPath] &&
    entry.entries &&
    Array.isArray(entry.entries)
  ) {
    const childrenDiv = document.createElement("div");
    childrenDiv.className = "folder-content";
    // Sort: folders first, then files, both alphabetically
    const sortedEntries = [...entry.entries].sort((a, b) => {
      if (a.type === "DIRECTORY" && b.type !== "DIRECTORY") return -1;
      if (a.type !== "DIRECTORY" && b.type === "DIRECTORY") return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  for (const entry of sortedEntries) {
    if (entry.type === 'DIRECTORY') {
      childrenDiv.appendChild(createFolderDiv(entry, folderPath, fileExplorerInstance, config));
    } else {
      childrenDiv.appendChild(createFileItem(entry, folderPath, fileExplorerInstance, config));
    }
  }
  folderDiv.appendChild(childrenDiv);
  }
  return folderDiv;
}

export function renderFileList(
  entries,
  container,
  rootFolder,
  fileExplorerInstance,
) {
  let fileList = container.querySelector("#file-list");
  if (!fileList) {
    fileList = document.createElement("div");
    fileList.id = "file-list";
    fileList.className = "file-list";
    container.appendChild(fileList);
  }

  // Defensive: handle undefined/null/empty entries
  if (!Array.isArray(entries)) {
    showNotification("Error: Could not read directory contents.", "error");
    return;
  }

  // Render the root folder as a folder node
  const config =
    fileExplorerInstance && fileExplorerInstance.config
      ? fileExplorerInstance.config
      : {};
  const folderName = rootFolder.split(/[\\/]/).pop();
  const rootEntry = {
    name: folderName,
    type: "DIRECTORY",
    isRoot: true,
    entries: entries,
    fullPath: rootFolder,
    absPath: rootFolder,
  };
  
    const folderDiv = createFolderDiv(rootEntry, '', fileExplorerInstance, config, true);
    fileList.innerHTML = '';
    fileList.appendChild(folderDiv);
}

export function updateSidebarHighlight(panelName) {
  // Stub: Highlight the active sidebar panel button.
  // panelName: "project-panel", "git-panel", etc.
}

// Add more UI-related exports as needed.
