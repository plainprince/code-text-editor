class CommandPalette {
  constructor() {
    this.isVisible = false;
    this.commands = [];
    this.init();
  }

  init() {
    this.registerCommands();
    this.bindEvents();
  }

  registerCommands() {
    this.commands = [
      {
        name: "Toggle File Explorer",
        action: () => window.fileExplorer.toggleExplorer(),
      },
      {
        name: "Add Folder to Workspace",
        action: () => window.openProject(),
      },
      {
        name: "Open Settings",
        action: () => {
          Neutralino.os.open(window.settings.settingsPath);
        },
      },
      // File operations
      {
        name: "New File",
        action: () => {
          if (window.fileExplorer && window.fileExplorer.selectedItems.length > 0) {
            const path = window.fileExplorer.selectedItems[0];
            window.fileExplorer.actions.createNewFile(path);
          }
        },
      },
      {
        name: "New Folder",
        action: () => {
          if (window.fileExplorer && window.fileExplorer.selectedItems.length > 0) {
            const path = window.fileExplorer.selectedItems[0];
            window.fileExplorer.actions.createNewFolder(path);
          }
        },
      },
      {
        name: "Copy",
        action: () => {
          if (window.fileExplorer && window.fileExplorer.selectedItems.length > 0) {
            const path = window.fileExplorer.selectedItems[0];
            window.fileExplorer.actions.copyItem(path);
          }
        },
      },
      {
        name: "Cut",
        action: () => {
          if (window.fileExplorer && window.fileExplorer.selectedItems.length > 0) {
            const path = window.fileExplorer.selectedItems[0];
            window.fileExplorer.actions.cutItem(path);
          }
        },
      },
      {
        name: "Paste",
        action: () => {
          if (window.fileExplorer && window.fileExplorer.selectedItems.length > 0) {
            const path = window.fileExplorer.selectedItems[0];
            window.fileExplorer.actions.pasteItem(path);
          }
        },
      },
      {
        name: "Rename",
        action: () => {
          if (window.fileExplorer && window.fileExplorer.selectedItems.length > 0) {
            const path = window.fileExplorer.selectedItems[0];
            window.fileExplorer.actions.renameItem(path);
          }
        },
      },
      {
        name: "Delete",
        action: () => {
          if (window.fileExplorer && window.fileExplorer.selectedItems.length > 0) {
            const path = window.fileExplorer.selectedItems[0];
            window.fileExplorer.actions.deleteItem(path);
          }
        },
      },
      {
        name: "Move to Trash",
        action: () => {
          if (window.fileExplorer && window.fileExplorer.selectedItems.length > 0) {
            const path = window.fileExplorer.selectedItems[0];
            window.fileExplorer.actions.trashItem(path);
          }
        },
      },
    ];
  }

  bindEvents() {
    const input = document.getElementById("command-palette-input");
    let selectedIdx = 0;

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "p") {
        e.preventDefault();
        this.toggle();
      }

      if (e.key === "Escape" && this.isVisible) {
        this.hide();
      }

      if (this.isVisible && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        const items = Array.from(
          document.querySelectorAll(".command-palette-item"),
        );
        if (!items.length) return;
        let current = items.findIndex((item) =>
          item.classList.contains("selected"),
        );
        if (current === -1) current = 0;
        if (e.key === "ArrowDown") {
          current = (current + 1) % items.length;
        } else if (e.key === "ArrowUp") {
          current = (current - 1 + items.length) % items.length;
        }
        items.forEach((item) => item.classList.remove("selected"));
        items[current].classList.add("selected");
        items[current].scrollIntoView({ block: "nearest" });
      }

      if (e.key === "Enter" && this.isVisible) {
        e.preventDefault();
        const selected = document.querySelector(
          ".command-palette-item.selected",
        );
        const fallback = document.querySelector(".command-palette-item");
        const toClick = selected || fallback;
        if (toClick) {
          toClick.click();
        }
      }
    });

    input.addEventListener("input", () => this.filterCommands(input.value));
  }

  toggle() {
    this.isVisible = !this.isVisible;
    const palette = document.getElementById("command-palette");
    palette.classList.toggle("hidden", !this.isVisible);

    if (this.isVisible) {
      this.renderCommands();
      document.getElementById("command-palette-input").focus();
    }
  }

  hide() {
    this.isVisible = false;
    document.getElementById("command-palette").classList.add("hidden");
  }

  filterCommands(query) {
    const filteredCommands = this.commands.filter((command) =>
      command.name.toLowerCase().includes(query.toLowerCase()),
    );
    this.renderCommands(filteredCommands);
  }

  renderCommands(commands = this.commands) {
    const resultsContainer = document.getElementById("command-palette-results");
    resultsContainer.innerHTML = "";

    commands.forEach((command) => {
      const commandElement = document.createElement("div");
      commandElement.className = "command-palette-item";
      commandElement.textContent = command.name;
      commandElement.addEventListener("click", () => {
        command.action();
        this.hide();
        // Clear input after action
        const input = document.getElementById("command-palette-input");
        if (input) input.value = "";
      });
      resultsContainer.appendChild(commandElement);
    });

    // Highlight the first item by default
    const firstItem = resultsContainer.querySelector(".command-palette-item");
    if (firstItem) {
      firstItem.classList.add("selected");
    }
  }
}
