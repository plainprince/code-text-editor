class Settings {
  constructor() {
    this.settings = null;
    this.settingsPath = "";
  }

  async _getAppDataPath() {
    let path;
    let home = "";
    if (NL_OS === "Windows") {
      // On Windows, use USERPROFILE for home, APPDATA for config root
      home = await Neutralino.os.getEnv("USERPROFILE");
      path = await Neutralino.os.getEnv("APPDATA");
    } else {
      // On macOS/Linux, use HOME
      home = await Neutralino.os.getEnv("HOME");
      if (NL_OS === "Darwin") {
        path = `${home}/Library/Application Support`;
      } else {
        path = `${home}/.config`;
      }
    }
    return `${path}/my-code-editor`;
  }

  async load() {
    const appDataPath = await this._getAppDataPath();
    this.settingsPath = `${appDataPath}/settings.json`;

    console.log("[Settings] AppData path resolved to:", appDataPath);
    console.log("[Settings] Settings file path:", this.settingsPath);

    try {
      console.log("[Settings] Attempting to read directory:", appDataPath);
      await Neutralino.filesystem.readDirectory(appDataPath);
      console.log("[Settings] Directory exists:", appDataPath);
    } catch (e) {
      console.error(
        "[Settings] Error reading directory (will try to create regardless of error code):",
        appDataPath,
        e,
      );
      try {
        await Neutralino.filesystem.createDirectory(appDataPath);
        console.log(`[Settings] Created settings directory at ${appDataPath}`);
      } catch (e2) {
        console.error(
          `[Settings] Failed to create settings directory at ${appDataPath}`,
          e2,
        );
        if (window.fileExplorer && typeof window.fileExplorer.showNotification === 'function') {
          window.fileExplorer.showNotification({
            message: `Unable to create settings directory: ${appDataPath}. Settings will not be saved.`,
            type: 'error',
          });
        }
        // Still continue, in case directory now exists or error is non-fatal
      }
    }

    try {
      console.log(
        "[Settings] Attempting to read settings file:",
        this.settingsPath,
      );
      const settingsContent = await Neutralino.filesystem.readFile(
        this.settingsPath,
      );
      this.settings = JSON.parse(settingsContent);
      console.log("[Settings] Loaded settings:", this.settings);
    } catch (e) {
      console.error(
        "[Settings] Error reading settings file:",
        this.settingsPath,
        e,
      );
      // Always create default settings if reading fails
      console.log("[Settings] Creating default settings due to read failure.");
      await this._createDefaultSettings();
    }
  }

  async _createDefaultSettings() {
    this.settings = {
      theme: "dark",
      fileExplorer: {
        themes: {
          default: {
            background: "#ffffff",
            text: "#000000",
            sidebar: "#f5f5f5",
            border: "#ddd",
            hover: "#e8e8e8",
            selected: "#007acc",
            fontFamily: "monospace",
            fontSize: "13px",
            fontPath: "./fonts/JetBrainsMono-Regular.ttf",
            welcomeDescFontSize: "12pt",
          },
          dark: {
            background: "#1e1e1e",
            text: "#ffffff",
            sidebar: "#252526",
            border: "#3c3c3c",
            hover: "#2a2d2e",
            selected: "#007acc",
            fontFamily: "monospace",
            fontSize: "13px",
            fontPath: "./fonts/JetBrainsMono-Regular.ttf",
            welcomeDescFontSize: "12px",
          },
        },
        shortcuts: {
          "new-file": "Ctrl+N",
          "new-folder": "Ctrl+Shift+N",
          copy: "Ctrl+C",
          cut: "Ctrl+X",
          paste: "Ctrl+V",
          delete: "Delete",
          rename: "F2",
        },
        icons: {
          folder:
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.9-2-2-2h-8l-2-2z"/></svg>',
          "folder-open":
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 20H4a2 2 0 0 1-2-2V6c0-1.11.89-2 2-2h6l2 2h7a2 2 0 0 1 2 2H4v10l2.14-8h17.07l-2.28 8.5c-.23.87-1.01 1.5-1.93 1.5z"/></svg>',
          file: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M6 2c-1.11 0-2 .89-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm8 7h-1V4l5 5h-4z"/></svg>',
          js: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.29 14.29L9.29 15H8v2H6v-4h3.71l1.42-1.42L9.71 10H6V8h4.71l1-1h2.58l-1 1H18v2h-4.29l-1 1H18v2h-3.29l-1.42 1.42L14.29 15H18v2h-4.29l-1 1h-2.58l1-1z"/></svg>',
          html: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
          css: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.29 14.29L9.29 15H8v2H6v-4h3.71l1.42-1.42L9.71 10H6V8h4.71l1-1h2.58l-1 1H18v2h-4.29l-1 1H18v2h-3.29l-1.42 1.42L14.29 15H18v2h-4.29l-1 1h-2.58l1-1z"/></svg>',
          json: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.11 0-2 .89-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
          md: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.11 0-2 .89-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
          "new-file":
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
          "new-folder":
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M20 6h-8l-2-2H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V8h2v3h3v2z"/></svg>',
        },
        currentTheme: "dark",
      },
    };
    await this.save();
  }

  async save() {
    if (!this.settingsPath) return;
    try {
      // Ensure parent directory exists
      const parentDir = this.settingsPath.substring(0, this.settingsPath.lastIndexOf('/'));
      try {
        await Neutralino.filesystem.readDirectory(parentDir);
      } catch (dirErr) {
        await Neutralino.filesystem.createDirectory(parentDir);
      }

      // Write settings with proper error handling
      await Neutralino.filesystem.writeFile(
        this.settingsPath,
        JSON.stringify(this.settings, null, 4),
      );
      console.log("[Settings] Successfully saved settings to:", this.settingsPath);
    } catch (e) {
      console.error("[Settings] Error saving settings:", e);
      if (window.fileExplorer && typeof window.fileExplorer.showNotification === 'function') {
        window.fileExplorer.showNotification({
          message: `Error saving settings: ${e.message || e}`,
          type: 'error',
        });
      }
      throw e; // Re-throw to allow caller to handle
    }
  }

  get(key) {
    // Always return a valid object for config consumers
    if (!this.settings) {
      console.warn(
        "[Settings] get() called but settings is undefined, returning empty object.",
      );
      return {};
    }
    return this.settings[key];
  }

  async set(key, value) {
    if (this.settings) {
      this.settings[key] = value;
      await this.save();
    }
  }
}
