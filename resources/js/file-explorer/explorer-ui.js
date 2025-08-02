/**
 * explorer-ui.js
 * UI rendering and DOM manipulation for the File Explorer.
 *
 * Exports functions for rendering file/folder lists, updating the sidebar,
 * and handling UI-specific updates.
 */

export function createFileIcon(entry, config, isOpen = false) {
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

export function updateSelection(fileExplorerInstance, path, ctrlKey, shiftKey, metaKey) {
  // Get all selectable items that are currently visible
  const allItems = Array.from(document.querySelectorAll('.file-item:not([style*="display: none"]), .folder-header:not([style*="display: none"]), .folder-content .file-item:not([style*="display: none"])'));
  const clickedIndex = allItems.findIndex(item => item.dataset.path === path);

  // Handle invalid selection
  if (clickedIndex === -1) {
    return;
  }

  // Handle selection based on modifier keys
  if (!shiftKey) {
    if (ctrlKey || metaKey) {
      // Toggle selection for Ctrl/Cmd click
      if (fileExplorerInstance.selectedItems.has(path)) {
        fileExplorerInstance.selectedItems.delete(path);
      } else {
        fileExplorerInstance.selectedItems.add(path);
      }
      fileExplorerInstance._selectionAnchor = path;
    } else {
      // Single click selects only this item
      fileExplorerInstance.selectedItems.clear();
      fileExplorerInstance.selectedItems.add(path);
      fileExplorerInstance._selectionAnchor = path;
    }
  } else {
    // Shift click extends selection
    if (!fileExplorerInstance._selectionAnchor) {
      fileExplorerInstance.selectedItems.clear();
      fileExplorerInstance.selectedItems.add(path);
      fileExplorerInstance._selectionAnchor = path;
    } else {
      const anchorIndex = allItems.findIndex(item => item.dataset.path === fileExplorerInstance._selectionAnchor);
      if (anchorIndex !== -1) {
        const start = Math.min(anchorIndex, clickedIndex);
        const end = Math.max(anchorIndex, clickedIndex);
        const rangeItems = allItems.slice(start, end + 1);
        
        if (!ctrlKey && !metaKey) {
          fileExplorerInstance.selectedItems.clear();
        }
        
        rangeItems.forEach(item => {
          fileExplorerInstance.selectedItems.add(item.dataset.path);
        });
      }
    }
  }

  // Update UI to reflect selection state
  allItems.forEach(item => {
    if (fileExplorerInstance.selectedItems.has(item.dataset.path)) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

export async function createFileItem(entry, parentPath, fileExplorerInstance, config) {
    if (!entry || !entry.name) {
        console.error("Invalid entry provided to createFileItem:", entry);
        return null;
    }

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
        updateSelection(fileExplorerInstance, item.dataset.path, e.ctrlKey, e.shiftKey, e.metaKey);
    });
    
    // Double click to open
    item.addEventListener("dblclick", (e) => {
        if (fileExplorerInstance && typeof fileExplorerInstance.openFile === "function") {
            fileExplorerInstance.openFile(item.dataset.path);
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

export async function createFolderDiv(
  entry,
  parentPath,
  fileExplorerInstance,
  config,
  isRoot = false,
  open = false,
) {
  if (!entry || !entry.name) {
    console.error("Invalid entry provided to createFolderDiv:", entry);
    return null;
  }

  const folderDiv = document.createElement("div");
  folderDiv.className = isRoot ? "root-folder" : "file-folder";
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
  headerDiv.className = isRoot ? "root-folder-header" : "folder-header";
  headerDiv.dataset.path = folderPath;
  headerDiv.innerHTML = `
        ${createFileIcon(entry, config, fileExplorerInstance._openFolders[folderPath])}
        <div class="file-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            <p style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${entry.name}</p>
        </div>
    `;

  // Add close button for root folders
  if (isRoot) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'root-folder-close';
    closeBtn.innerHTML = '×';
    closeBtn.title = 'Remove from workspace';
    closeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = fileExplorerInstance.rootFolders.indexOf(folderPath);
      if (index !== -1) {
        fileExplorerInstance.rootFolders.splice(index, 1);
        folderDiv.remove();
        await fileExplorerInstance.saveWorkspaceState();
      }
    });
    headerDiv.appendChild(closeBtn);
  }

  // Toggle open/close on header click
  headerDiv.addEventListener("click", (e) => {
    if (e.detail === 1) { // single click
      updateSelection(fileExplorerInstance, headerDiv.dataset.path, e.ctrlKey, e.shiftKey, e.metaKey);
      // Use setTimeout to allow the selection to complete first
      setTimeout(() => {
        fileExplorerInstance.toggleFolder(folderPath);
      }, 0);
      e.stopPropagation(); // Prevent event bubbling
    }
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

  // Create an empty content div for all folders
  // This will be populated when the folder is opened
  const childrenDiv = document.createElement("div");
  childrenDiv.className = "folder-content";
  
  // Set initial display style based on open state
  childrenDiv.style.display = fileExplorerInstance._openFolders[folderPath] ? '' : 'none';
  
  // Add the content div to the folder
  folderDiv.appendChild(childrenDiv);
  
  // If the folder is open and has pre-loaded entries, show them
  if (fileExplorerInstance._openFolders[folderPath] && Array.isArray(entry.entries) && entry.entries.length > 0) {
    try {
      // Process each entry to ensure it has a name
      const processedEntries = entry.entries.map(childEntry => ({
        ...childEntry,
        name: childEntry.name || childEntry.entry
      }));
      
      // Create child elements for files only (folders will be loaded when clicked)
      for (const childEntry of processedEntries) {
        if (childEntry.type !== 'DIRECTORY') {
          const childPath = `${folderPath}/${childEntry.name}`;
          const fileElement = await createFileItem({ 
            ...childEntry, 
            fullPath: childPath 
          }, folderPath, fileExplorerInstance, config);
          
          if (fileElement) {
            childrenDiv.appendChild(fileElement);
          }
        }
      }
    } catch (error) {
      console.error(`Error creating children for folder ${folderPath}:`, error);
    }
  }
  return folderDiv;
}

export async function renderFileList(
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
    console.error("Error: Could not read directory contents.");
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
    entry: folderName,
    type: "DIRECTORY",
    isRoot: true,
    entries: entries,
    fullPath: rootFolder,
    absPath: rootFolder,
  };
  
  const folderDiv = await createFolderDiv(rootEntry, '', fileExplorerInstance, config, true);
  fileList.innerHTML = '';
  fileList.appendChild(folderDiv);
}

export function updateSidebarHighlight(panelName) {
  // Stub: Highlight the active sidebar panel button.
  // panelName: "project-panel", "git-panel", etc.
}

// Add more UI-related exports as needed.
