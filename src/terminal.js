// terminal.js - Real terminal emulator with PTY support using xterm.js

import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from "@tauri-apps/api/event";

class LocalTerminal {
  constructor(container, sessionId = null) {
    this.container = container;
    this.isActive = false;
    this.sessionId = sessionId || `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.workingDirectory = null;
    this.xterm = null;
    this.fitAddon = null;
    this.sessionCreated = false;
    this.initialPromptSent = false; // Track if initial prompt was sent
    
    // Don't auto-init if no container provided (for tab management)
    if (this.container) {
      this.init();
    }
  }
  
  async init() {
    if (this.container) {
      this.createTerminalUI();
      await this.createSession();
    }
  }
  
  // Initialize terminal in a specific container (for tab management)
  async initInContainer(xtermContainer) {
    if (!xtermContainer) return;
    
    // Get terminal settings from global settings
    const terminalSettings = window.settings?.terminal || {};
    const fontSettings = terminalSettings.font || {};
    const cursorSettings = terminalSettings.cursor || {};
    const themeSettings = terminalSettings.theme || {};
    
    // Create xterm.js instance with customizable settings
    this.xterm = new XTerm({
      cursorBlink: cursorSettings.blink !== false,
      cursorStyle: cursorSettings.style || 'block',
      fontSize: fontSettings.size || 14,
      fontFamily: fontSettings.family || '"Cascadia Code", "Fira Code", "Consolas", "Monaco", "Courier New", monospace',
      theme: {
        background: themeSettings.background || '#1e1e1e',
        foreground: themeSettings.foreground || '#ffffff',
        cursor: themeSettings.cursor || '#ffffff',
        selection: themeSettings.selection || '#3a3a3a',
        black: themeSettings.black || '#000000',
        red: themeSettings.red || '#cd3131',
        green: themeSettings.green || '#0dbc79',
        yellow: themeSettings.yellow || '#e5e510',
        blue: themeSettings.blue || '#2472c8',
        magenta: themeSettings.magenta || '#bc3fbc',
        cyan: themeSettings.cyan || '#11a8cd',
        white: themeSettings.white || '#e5e5e5',
        brightBlack: themeSettings.brightBlack || '#666666',
        brightRed: themeSettings.brightRed || '#f14c4c',
        brightGreen: themeSettings.brightGreen || '#23d18b',
        brightYellow: themeSettings.brightYellow || '#f5f543',
        brightBlue: themeSettings.brightBlue || '#3b8eea',
        brightMagenta: themeSettings.brightMagenta || '#d670d6',
        brightCyan: themeSettings.brightCyan || '#29b8db',
        brightWhite: themeSettings.brightWhite || '#ffffff'
      }
    });
    
    // Create fit addon for automatic resizing
    this.fitAddon = new FitAddon();
    this.xterm.loadAddon(this.fitAddon);
    
    // Set initial background color to match settings
    xtermContainer.style.backgroundColor = themeSettings.background || '#1e1e1e';
    
    this.xterm.open(xtermContainer);
    
    // Fit terminal to container
    this.fitAddon.fit();
    
    // Handle user input
    this.xterm.onData((data) => {
      this.writeToTerminal(data);
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      if (this.isActive) {
        setTimeout(() => this.resize(), 100);
      }
    });
    
    // Listen for terminal output from the backend
    this.setupOutputListener();
    
    // Create session only if it doesn't exist yet
    if (!this.sessionCreated) {
      await this.createSession();
    }
  }
  
  createTerminalUI() {
    const terminal = document.getElementById("terminal");
    if (!terminal) return;
    
    const content = terminal.querySelector(".terminal-content");
    if (!content) return;
    
    // Clear existing content
    content.innerHTML = `<div class="terminal-xterm" id="terminal-xterm"></div>`;
    
    // Get terminal settings from global settings
    const terminalSettings = window.settings?.terminal || {};
    const fontSettings = terminalSettings.font || {};
    const cursorSettings = terminalSettings.cursor || {};
    const themeSettings = terminalSettings.theme || {};
    
    // Create xterm.js instance with customizable settings
    this.xterm = new XTerm({
      cursorBlink: cursorSettings.blink !== false,
      cursorStyle: cursorSettings.style || 'block',
      fontSize: fontSettings.size || 14,
      fontFamily: fontSettings.family || '"Cascadia Code", "Fira Code", "Consolas", "Monaco", "Courier New", monospace',
      theme: {
        background: themeSettings.background || '#1e1e1e',
        foreground: themeSettings.foreground || '#ffffff',
        cursor: themeSettings.cursor || '#ffffff',
        selection: themeSettings.selection || '#3a3a3a',
        black: themeSettings.black || '#000000',
        red: themeSettings.red || '#cd3131',
        green: themeSettings.green || '#0dbc79',
        yellow: themeSettings.yellow || '#e5e510',
        blue: themeSettings.blue || '#2472c8',
        magenta: themeSettings.magenta || '#bc3fbc',
        cyan: themeSettings.cyan || '#11a8cd',
        white: themeSettings.white || '#e5e5e5',
        brightBlack: themeSettings.brightBlack || '#666666',
        brightRed: themeSettings.brightRed || '#f14c4c',
        brightGreen: themeSettings.brightGreen || '#23d18b',
        brightYellow: themeSettings.brightYellow || '#f5f543',
        brightBlue: themeSettings.brightBlue || '#3b8eea',
        brightMagenta: themeSettings.brightMagenta || '#d670d6',
        brightCyan: themeSettings.brightCyan || '#29b8db',
        brightWhite: themeSettings.brightWhite || '#ffffff'
      }
    });
    
    // Create fit addon for automatic resizing
    this.fitAddon = new FitAddon();
    this.xterm.loadAddon(this.fitAddon);
    
    // Open terminal in the container
    const xtermContainer = content.querySelector("#terminal-xterm");
    if (!xtermContainer) return;
    
    // Set initial background color to match settings
    xtermContainer.style.backgroundColor = themeSettings.background || '#1e1e1e';
    
    this.xterm.open(xtermContainer);
    
    // Fit terminal to container
    this.fitAddon.fit();
    
    // Handle user input
    this.xterm.onData((data) => {
      this.writeToTerminal(data);
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      if (this.isActive) {
        setTimeout(() => this.resize(), 100);
      }
    });
    
    // Listen for terminal output from the backend
    this.setupOutputListener();
  }
  
  async createSession() {
    if (this.sessionCreated) return;
    
    // Retry logic for session creation
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await invoke("create_terminal_session", { 
          sessionId: this.sessionId,
          workingDirectory: this.workingDirectory
        });
        this.sessionCreated = true;
        
        // Send a newline to trigger shell prompt (after a small delay)
        // Only do this once to avoid duplicate prompts
        if (!this.initialPromptSent) {
          this.initialPromptSent = true;
          setTimeout(async () => {
            try {
              // Send a carriage return to trigger the shell prompt
              await this.writeToTerminal('\r');
              // Wait a bit and send another one if needed
              setTimeout(async () => {
                try {
                  await this.writeToTerminal('');
                } catch (e) {
                  console.error('Could not send follow-up prompt:', e);
                }
              }, 100);
            } catch (e) {
              console.error('Could not send initial newline:', e);
            }
          }, 500); // Increased delay to ensure PTY is ready
        }
        
        console.log(`Terminal session ${this.sessionId} created successfully`);
        return; // Success, exit retry loop
        
      } catch (err) {
        console.error(`Failed to create terminal session (attempt ${attempt}/${maxRetries}):`, err);
        
        if (attempt === maxRetries) {
          // Final attempt failed
          if (this.xterm) {
            this.xterm.write(`\r\n\x1b[31mFailed to start terminal after ${maxRetries} attempts: ${err}\x1b[0m\r\n`);
          }
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }
  
  setupOutputListener() {
    // Listen for output from the PTY
    listen(`terminal-output-${this.sessionId}`, (event) => {
      if (this.xterm && event && event.payload) {
        this.xterm.write(event.payload);
      }
    }).catch(err => {
      console.error('Failed to setup terminal output listener:', err);
    });
  }
  
  async writeToTerminal(data) {
    try {
      await invoke("write_to_terminal", {
        sessionId: this.sessionId,
        data: data
      });
    } catch (err) {
      console.error("Failed to write to terminal:", err);
      
      // If session not found, try to recreate it
      if (err.toString().includes("Terminal session not found")) {
        console.log(`Terminal session ${this.sessionId} not found, recreating...`);
        this.sessionCreated = false;
        this.initialPromptSent = false;
        try {
          await this.createSession();
          // Retry the write after recreating session
          await invoke("write_to_terminal", {
            sessionId: this.sessionId,
            data: data
          });
        } catch (recreateErr) {
          console.error("Failed to recreate terminal session:", recreateErr);
        }
      }
    }
  }
  
  clearOutput() {
    if (this.xterm) {
      this.xterm.clear();
    }
  }
  
  async setWorkingDirectory(path) {
    this.workingDirectory = path;
    
    // If terminal session exists, recreate it with new working directory
    if (this.sessionId) {
      await this.recreateSession();
    }
  }

  async recreateSession() {
    try {
      // Close existing session
      await this.destroy();
      
      // Clear output
      this.clearOutput();
      
      // Create new session with updated working directory
      this.sessionId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await this.createSession();
      
      // Re-setup output listener
      this.setupOutputListener();
    } catch (err) {
      console.error("Failed to recreate terminal session:", err);
      if (this.xterm) {
        this.xterm.write(`\r\n\x1b[31mFailed to recreate terminal: ${err}\x1b[0m\r\n`);
      }
    }
  }
  
  async show() {
    const terminal = document.getElementById("terminal");
    if (terminal) {
      terminal.style.display = 'flex';
      this.isActive = true;
      
      // Ensure session exists when showing terminal
      if (!this.sessionCreated) {
        console.log(`Ensuring terminal session ${this.sessionId} exists...`);
        await this.createSession();
      }
      
      // Focus xterm terminal
      if (this.xterm) {
        this.xterm.focus();
      }
      
      // Resize terminal to fit
      setTimeout(() => this.resize(), 100); // Small delay to ensure layout is complete
    }
  }
  
  hide() {
    const terminal = document.getElementById("terminal");
    if (terminal) {
      terminal.style.display = 'none';
      this.isActive = false;
    }
  }
  
  toggle() {
    if (this.isActive) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  async resize() {
    if (!this.xterm || !this.fitAddon) return;
    
    try {
      // Fit xterm to container
      this.fitAddon.fit();
      
      // Get the new dimensions
      const cols = this.xterm.cols;
      const rows = this.xterm.rows;
      
      // Update PTY size in backend
      await invoke("resize_terminal", {
        sessionId: this.sessionId,
        rows: rows,
        cols: cols
      });
    } catch (err) {
      console.error("Failed to resize terminal:", err);
      
      // If session not found, try to recreate it
      if (err.toString().includes("Terminal session not found")) {
        console.log(`Terminal session ${this.sessionId} not found during resize, recreating...`);
        this.sessionCreated = false;
        this.initialPromptSent = false;
        try {
          await this.createSession();
          // Retry the resize after recreating session
          await invoke("resize_terminal", {
            sessionId: this.sessionId,
            rows: rows,
            cols: cols
          });
        } catch (recreateErr) {
          console.error("Failed to recreate terminal session during resize:", recreateErr);
        }
      }
    }
  }
  
  // Update terminal settings
  updateSettings() {
    if (!this.xterm) return;
    
    // Get updated terminal settings
    const terminalSettings = window.settings?.terminal || {};
    const fontSettings = terminalSettings.font || {};
    const cursorSettings = terminalSettings.cursor || {};
    const themeSettings = terminalSettings.theme || {};
    
    // Update font settings
    this.xterm.options.fontSize = fontSettings.size || 14;
    this.xterm.options.fontFamily = fontSettings.family || '"Cascadia Code", "Fira Code", "Consolas", "Monaco", "Courier New", monospace';
    
    // Update cursor settings
    this.xterm.options.cursorBlink = cursorSettings.blink !== false;
    this.xterm.options.cursorStyle = cursorSettings.style || 'block';
    
    // Update theme
    this.xterm.options.theme = {
      background: themeSettings.background || '#1e1e1e',
      foreground: themeSettings.foreground || '#ffffff',
      cursor: themeSettings.cursor || '#ffffff',
      selection: themeSettings.selection || '#3a3a3a',
      black: themeSettings.black || '#000000',
      red: themeSettings.red || '#cd3131',
      green: themeSettings.green || '#0dbc79',
      yellow: themeSettings.yellow || '#e5e510',
      blue: themeSettings.blue || '#2472c8',
      magenta: themeSettings.magenta || '#bc3fbc',
      cyan: themeSettings.cyan || '#11a8cd',
      white: themeSettings.white || '#e5e5e5',
      brightBlack: themeSettings.brightBlack || '#666666',
      brightRed: themeSettings.brightRed || '#f14c4c',
      brightGreen: themeSettings.brightGreen || '#23d18b',
      brightYellow: themeSettings.brightYellow || '#f5f543',
      brightBlue: themeSettings.brightBlue || '#3b8eea',
      brightMagenta: themeSettings.brightMagenta || '#d670d6',
      brightCyan: themeSettings.brightCyan || '#29b8db',
      brightWhite: themeSettings.brightWhite || '#ffffff'
    };
    
    // Update CSS background to match terminal theme
    const xtermContainer = document.getElementById('terminal-xterm');
    if (xtermContainer) {
      xtermContainer.style.backgroundColor = themeSettings.background || '#1e1e1e';
    }
    
    // Refresh the terminal to apply changes
    this.xterm.refresh(0, this.xterm.rows - 1);
    
    // Resize to ensure everything is properly displayed
    if (this.fitAddon && this.isActive) {
      setTimeout(() => this.resize(), 100);
    }
  }

  async destroy() {
    try {
      if (this.xterm) {
        this.xterm.dispose();
        this.xterm = null;
      }
      await invoke("close_terminal_session", {
        sessionId: this.sessionId
      });
    } catch (err) {
      console.error("Failed to close terminal session:", err);
    }
  }
}

// Function to get LocalTerminal class reference at runtime
function getTerminalClass() {
  return LocalTerminal;
}

// TerminalManager class to handle multiple terminal tabs
class TerminalManager {
  constructor() {
    this.terminals = new Map(); // terminalId -> Terminal instance
    this.currentTerminalId = null;
    this.nextTerminalId = 1;
    // Store reference to Terminal class getter to avoid binding issues
    this.getTerminalClass = getTerminalClass;
    this.container = null;
    this.tabsContainer = null;
    this.contentContainer = null;
    this.preSpawnedTerminals = []; // Pool of ready terminals
    this.currentWorkingDirectory = null; // Track working directory
    
    // Initialize asynchronously to avoid blocking
    setTimeout(() => this.init(), 0);
  }
  
  async init() {
    this.setupUI();
    
    // Wait for Tauri to be ready
    await this.waitForTauri();
    
    // Don't auto-create terminal - wait for user to open terminal panel
    console.log('Terminal manager initialized, ready to create terminals when needed');
  }
  
  // Wait for Tauri API to be available
  async waitForTauri(maxRetries = 10) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Test if Tauri invoke is available
        await invoke('get_version').catch(() => {
          // get_version command might not exist, but if invoke throws a different error,
          // it means Tauri is available
          return null;
        });
        console.log('Tauri is ready for terminal initialization');
        return true;
      } catch (error) {
        if (error.message && error.message.includes('command')) {
          // Command not found error means Tauri is available but command doesn't exist
          console.log('Tauri is ready for terminal initialization');
          return true;
        }
        console.log(`Waiting for Tauri to be ready... attempt ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    console.warn('Tauri not ready after maximum retries, proceeding anyway');
    return false;
  }
  
  setupUI() {
    const terminalElement = document.getElementById("terminal");
    if (!terminalElement) {
      console.error('Terminal element not found in DOM');
      return;
    }
    
    // The terminal structure already exists in the HTML, just get references
    this.container = terminalElement;
    this.tabsContainer = document.getElementById("terminal-tabs");
    this.contentContainer = document.getElementById("terminal-content");
    
    if (!this.tabsContainer || !this.contentContainer) {
      console.error('Terminal tabs or content container not found');
      return;
    }
    
    // Set up event listeners
    const newTerminalButton = document.getElementById("terminal-tab-new");
    if (newTerminalButton) {
      newTerminalButton.addEventListener("click", async () => {
        await this.createNewTerminal();
      });
    }
  }
  
  async createNewTerminal() {
    try {
      const currentId = this.nextTerminalId++;
      const terminalId = `terminal-${currentId}`;
      let terminal;
      
      // Create new terminal directly (disable pre-spawning for now to debug)
      const sessionId = `session-${currentId}-${Date.now()}`;
      const TerminalConstructor = this.getTerminalClass();
      terminal = new TerminalConstructor(null, sessionId);
      terminal.workingDirectory = this.currentWorkingDirectory;
      
      // Store terminal
      this.terminals.set(terminalId, terminal);
      
      // Create tab
      this.createTab(terminalId);
      
      // Create content container for this terminal
      const terminalContainer = document.createElement('div');
      terminalContainer.className = 'terminal-session-container';
      terminalContainer.id = `terminal-container-${terminalId}`;
      terminalContainer.style.display = 'none';
      terminalContainer.innerHTML = `<div class="terminal-xterm" id="terminal-xterm-${terminalId}"></div>`;
      
      if (!this.contentContainer) {
        console.error('Terminal content container not found');
        return null;
      }
      
      this.contentContainer.appendChild(terminalContainer);
      
      // Initialize terminal with specific container
      const xtermContainer = terminalContainer.querySelector('.terminal-xterm');
      if (xtermContainer) {
        await terminal.initInContainer(xtermContainer);
      } else {
        console.error('Could not find xterm container');
        return null;
      }
      
      // Switch to new terminal immediately
      this.switchToTerminal(terminalId);
      
      // Ensure the terminal is focused and active
      setTimeout(() => {
        const terminal = this.terminals.get(terminalId);
        if (terminal && terminal.xterm) {
          terminal.xterm.focus();
        }
      }, 50);
      
      // Temporarily disabled pre-spawning for debugging
      // this.preSpawnTerminal();
      
      return terminalId;
    } catch (err) {
      console.error('Failed to create new terminal:', err);
      return null;
    }
  }
  
  async preSpawnTerminal() {
    try {
      // Don't pre-spawn too many terminals
      if (this.preSpawnedTerminals.length >= 1) return;
      
      const sessionId = `session-prespawn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const TerminalConstructor = this.getTerminalClass();
      const terminal = new TerminalConstructor(null, sessionId);
      
      // Set working directory for pre-spawned terminals
      terminal.workingDirectory = this.currentWorkingDirectory || null;
      
      // Pre-create the session in the background
      await terminal.createSession();
      
      this.preSpawnedTerminals.push(terminal);
    } catch (err) {
      console.error('Failed to pre-spawn terminal:', err);
    }
  }
  
  createTab(terminalId) {
    const tab = document.createElement('div');
    tab.className = 'terminal-tab';
    tab.id = `terminal-tab-${terminalId}`;
    tab.innerHTML = `
      <span class="terminal-tab-title">Terminal ${terminalId.split('-')[1]}</span>
      <button class="terminal-tab-close" data-terminal-id="${terminalId}">×</button>
    `;
    
    // Tab click handler
    tab.addEventListener('click', (e) => {
      if (!e.target.classList.contains('terminal-tab-close')) {
        this.switchToTerminal(terminalId);
      }
    });
    
    // Close button handler
    tab.querySelector('.terminal-tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTerminal(terminalId);
    });
    
    this.tabsContainer.appendChild(tab);
  }
  
  switchToTerminal(terminalId) {
    if (!this.terminals.has(terminalId)) return;
    
    // Hide all terminal containers
    this.contentContainer.querySelectorAll('.terminal-session-container').forEach(container => {
      container.style.display = 'none';
    });
    
    // Remove active class from all tabs
    this.tabsContainer.querySelectorAll('.terminal-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Show current terminal container
    const container = document.getElementById(`terminal-container-${terminalId}`);
    if (container) {
      container.style.display = 'block';
    }
    
    // Add active class to current tab
    const tab = document.getElementById(`terminal-tab-${terminalId}`);
    if (tab) {
      tab.classList.add('active');
    }
    
    // Update current terminal
    this.currentTerminalId = terminalId;
    const terminal = this.terminals.get(terminalId);
    
    // Focus terminal and resize
    if (terminal && terminal.xterm) {
      terminal.xterm.focus();
      setTimeout(() => terminal.resize(), 100);
    }
  }
  
  closeTerminal(terminalId) {
    if (!this.terminals.has(terminalId)) return;
    
    const terminal = this.terminals.get(terminalId);
    
    // Destroy terminal
    if (terminal) {
      terminal.destroy();
    }
    
    // Remove terminal from map
    this.terminals.delete(terminalId);
    
    // Remove tab
    const tab = document.getElementById(`terminal-tab-${terminalId}`);
    if (tab) {
      tab.remove();
    }
    
    // Remove container
    const container = document.getElementById(`terminal-container-${terminalId}`);
    if (container) {
      container.remove();
    }
    
    // If this was the current terminal, switch to another one
    if (this.currentTerminalId === terminalId) {
      this.currentTerminalId = null;
      
      // Switch to first available terminal
      if (this.terminals.size > 0) {
        const firstTerminalId = this.terminals.keys().next().value;
        this.switchToTerminal(firstTerminalId);
      }
    }
    
    // If no terminals left, create a new one
    if (this.terminals.size === 0) {
      this.createNewTerminal();
    }
  }
  
  getCurrentTerminal() {
    if (this.currentTerminalId && this.terminals.has(this.currentTerminalId)) {
      return this.terminals.get(this.currentTerminalId);
    }
    return null;
  }
  
  focus() {
    const currentTerminal = this.getCurrentTerminal();
    if (currentTerminal) {
      currentTerminal.isActive = true;
      if (currentTerminal.xterm) {
        currentTerminal.xterm.focus();
      }
      setTimeout(() => currentTerminal.resize(), 100);
    }
  }
  
  setWorkingDirectory(path) {
    // Store the working directory for new terminals
    this.currentWorkingDirectory = path;
    
    // Set working directory for all terminals
    this.terminals.forEach(terminal => {
      terminal.setWorkingDirectory(path);
    });
    
    // Update pre-spawned terminals working directory
    this.preSpawnedTerminals.forEach(terminal => {
      terminal.workingDirectory = path;
    });
  }
  
  updateSettings() {
    // Update settings for all terminals
    this.terminals.forEach(terminal => {
      terminal.updateSettings();
    });
  }
  
  resize() {
    const currentTerminal = this.getCurrentTerminal();
    if (currentTerminal) {
      currentTerminal.resize();
    }
  }
}

// Explicit exports to ensure proper binding
export { LocalTerminal as Terminal };
export { TerminalManager };
export default TerminalManager;