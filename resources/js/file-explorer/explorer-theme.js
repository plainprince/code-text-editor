/**
 * explorer-theme.js
 * Handles theme and config logic for the File Explorer.
 */

export function applyExplorerTheme(config) {
    const root = document.documentElement;
    const theme = config.themes?.[config.currentTheme] || config.themes?.default || {};

    if (theme.fontPath) {
        // You may want to implement a font loader elsewhere and call it here
        // loadCustomFont(theme.fontPath, theme.fontFamily);
    }

    // Base theme
    root.style.setProperty("--file-explorer-bg", theme.background || "#fff");
    root.style.setProperty("--file-explorer-text", theme.text || "#000");
    root.style.setProperty("--file-explorer-sidebar", theme.sidebar || "#f5f5f5");
    root.style.setProperty("--file-explorer-border", theme.border || "#ddd");
    root.style.setProperty("--file-explorer-hover", theme.hover || "#e8e8e8");
    root.style.setProperty("--file-explorer-selected", theme.selected || "#007acc");
    root.style.setProperty("--file-explorer-font-family", theme.fontFamily || "monospace");
    root.style.setProperty("--file-explorer-font-size", theme.fontSize || "15px");

    // Context menu theme
    if (theme.contextMenu) {
        root.style.setProperty("--context-menu-bg", theme.contextMenu.background);
        root.style.setProperty("--context-menu-text", theme.contextMenu.text);
        root.style.setProperty("--context-menu-border", theme.contextMenu.border);
        root.style.setProperty("--context-menu-hover", theme.contextMenu.hover);
        root.style.setProperty("--context-menu-shortcut", theme.contextMenu.shortcut);
    }

    // Sidebar active icon color
    if (config.sidebarActiveIcon) {
        root.style.setProperty("--sidebar-active-icon", config.sidebarActiveIcon);
    }

    // Welcome description font size
    if (theme.welcomeDescFontSize) {
        root.style.setProperty("--welcome-desc-font-size", theme.welcomeDescFontSize);
    }
}

// Optionally, export other theme/config utilities here
