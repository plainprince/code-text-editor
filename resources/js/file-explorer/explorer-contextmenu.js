/**
 * explorer-contextmenu.js
 * Handles context menu logic for the file explorer.
 *
 * Exports:
 *   - showContextMenu
 *   - hideContextMenu
 *   - getContextMenuItems
 */

let currentMenu = null;

export function showContextMenu(event, context) {
  hideContextMenu();

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.style.position = "fixed";
  menu.style.left = event.clientX + "px";
  menu.style.top = event.clientY + "px";
  menu.style.zIndex = 2000;

  const items = getContextMenuItems(context);
  items.forEach((item) => {
    if (item === "separator") {
      const sep = document.createElement("div");
      sep.className = "menu-separator";
      menu.appendChild(sep);
    } else {
      const menuItem = document.createElement("div");
      menuItem.className = "menu-item";
      menuItem.textContent = item.label;
      if (item.shortcut) {
        const shortcut = document.createElement("span");
        shortcut.className = "menu-shortcut";
        shortcut.textContent = item.shortcut;
        menuItem.appendChild(shortcut);
      }
      menuItem.addEventListener("click", (e) => {
        e.stopPropagation();
        hideContextMenu();
        item.action && item.action(context);
      });
      menu.appendChild(menuItem);
    }
  });

  document.body.appendChild(menu);
  currentMenu = menu;

  // Hide on click outside
  setTimeout(() => {
    document.addEventListener("mousedown", handleClickOutside, { once: true });
  }, 0);

  function handleClickOutside(e) {
    if (!menu.contains(e.target)) {
      hideContextMenu();
    }
  }
}

export function hideContextMenu() {
  if (currentMenu && currentMenu.parentNode) {
    currentMenu.parentNode.removeChild(currentMenu);
  }
  currentMenu = null;
}



export function getContextMenuItems(context) {
  // context: { path, type, name, entry }
  const items = [];

  const parent = context.path.substring(0, context.path.lastIndexOf("/"));

  if (context.type === "DIRECTORY") {
    items.push({
      label: "New File",
      shortcut: "Ctrl+N",
      action: (ctx) => window.fileExplorer.createNewFile(ctx.path),
    });
    items.push({
      label: "New Folder",
      shortcut: "Ctrl+Shift+N",
      action: (ctx) => window.fileExplorer.createNewFolder(ctx.path),
    });
  } else if (context.type === "FILE") {
    items.push({
      label: "New File",
      action: (ctx) => window.fileExplorer.createNewFile(parent),
    });
    items.push({
      label: "New Folder",
      action: (ctx) => window.fileExplorer.createNewFolder(parent),
    });
  }

  items.push("separator");

  if (context.type === "FILE") {
    items.push({
      label: "Open in default app",
      action: (ctx) => window.fileExplorer.openFile(ctx.path),
    });
  }

  items.push({
    label: "Find in folder",
    action: (ctx) => window.fileExplorer.findInFolder(ctx.path),
  });

  items.push("separator");

  items.push({
    label: "Cut",
    action: (ctx) => window.fileExplorer.cutItem(ctx.path),
  });

  items.push({
    label: "Copy",
    action: (ctx) => window.fileExplorer.copyItem(ctx.path),
  });

  items.push({
    label: "Paste",
    action: (ctx) => {
      if (window.fileExplorer.clipboard) {
        window.fileExplorer.pasteItem(ctx.path);
      }
    },
    disabled: !window.fileExplorer.clipboard,
  });

  items.push({
    label: "Duplicate",
    action: (ctx) => window.fileExplorer.duplicateItem(ctx.path),
  });

  items.push("separator");

  items.push({
    label: "Rename",
    action: (ctx) => window.fileExplorer.renameItem(ctx.path),
  });

  items.push({
    label: "Delete",
    action: (ctx) => window.fileExplorer.deleteItem(ctx.path),
  });

  items.push({
    label: "Move to trash",
    action: (ctx) => window.fileExplorer.trashItem(ctx.path),
  });

  items.push("separator");

  items.push({
    label: "Copy Path",
    action: (ctx) => navigator.clipboard.writeText(ctx.path),
  });

  items.push({
    label: "Copy Relative Path",
    action: (ctx) => {
      const rootFolder = window.fileExplorer.rootFolders.find(folder => ctx.path.startsWith(folder));
      const relativePath = ctx.path.substring(rootFolder.length + 1);
      navigator.clipboard.writeText(relativePath);
    },
  });

  items.push("separator");

  items.push({
    label: "Open in Terminal",
    action: (ctx) => {
      const termPath = context.type === "FILE" ? parent : ctx.path;
      window.fileExplorer.openInTerminal(termPath);
    },
  });

  return items;
}
