// Tests for Terminal functionality
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TerminalManager } from '../terminal.js';

describe('TerminalManager', () => {
  let manager;
  let mockTerminalElement;

  beforeEach(async () => {
    // Restore mocks and timers before each test
    vi.restoreAllMocks();

    // Setup DOM
    document.body.innerHTML = `
      <div id="terminal">
        <div class="terminal-header">
          <div class="terminal-tabs" id="terminal-tabs"></div>
          <div class="terminal-controls">
            <button class="terminal-tab-new" id="terminal-tab-new" title="New Terminal">+</button>
          </div>
        </div>
        <div class="terminal-content" id="terminal-content"></div>
      </div>
      <div id="bottom-panels" style="display: none;"></div>
      <button id="terminal-panel-tab">Terminal</button>
    `;

    mockTerminalElement = document.getElementById('terminal');

    // Mock Tauri APIs
    global.window.__TAURI__ = {
      core: {
        invoke: vi.fn().mockResolvedValue('session-id'),
      },
      event: {
        listen: vi.fn().mockResolvedValue(() => {}),
      },
    };
    
    const originalSetTimeout = global.setTimeout;
    vi.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
      if (delay === 0) {
        // Prevent the constructor's auto-init
        return { unref: vi.fn() }; 
      }
      // Use the original setTimeout for all other calls
      return originalSetTimeout(fn, delay);
    });
    
    manager = new TerminalManager();
    
    // Manually initialize the manager for the test suite
    const createTerminalSpy = vi.spyOn(manager, 'createNewTerminal').mockResolvedValue(null);
    await manager.init();
    createTerminalSpy.mockRestore();

    // Clear any mock calls that happened during init
    global.window.__TAURI__.core.invoke.mockClear();
  });

  it('should initialize with no terminals', () => {
    expect(manager.terminals.size).toBe(0);
    expect(manager.currentTerminalId).toBeNull();
    expect(manager.nextTerminalId).toBe(1);
  });

  it('should setup UI elements correctly', () => {
    expect(manager.container).toBe(mockTerminalElement);
    expect(manager.tabsContainer).toBeTruthy();
    expect(manager.contentContainer).toBeTruthy();
  });

  it('should create new terminal with correct ID', async () => {
    const terminalId = await manager.createNewTerminal();
    
    expect(terminalId).toBe('terminal-1');
    expect(manager.terminals.has('terminal-1')).toBe(true);
    expect(manager.currentTerminalId).toBe('terminal-1');
    expect(manager.nextTerminalId).toBe(2);
  });

  it('should switch between terminals', async () => {
    // Create two terminals
    const terminal1 = await manager.createNewTerminal();
    const terminal2 = await manager.createNewTerminal();

    expect(manager.currentTerminalId).toBe(terminal2);

    // Switch back to first terminal
    manager.switchToTerminal(terminal1);
    expect(manager.currentTerminalId).toBe(terminal1);
  });

  it('should close terminals correctly', async () => {
    const terminal1 = await manager.createNewTerminal();
    const terminal2 = await manager.createNewTerminal();

    expect(manager.terminals.size).toBe(2);

    manager.closeTerminal(terminal1);
    expect(manager.terminals.size).toBe(1);
    expect(manager.terminals.has(terminal1)).toBe(false);
    expect(manager.currentTerminalId).toBe(terminal2);
  });

  it('should get current terminal', async () => {
    expect(manager.getCurrentTerminal()).toBeNull();

    const terminalId = await manager.createNewTerminal();
    const currentTerminal = manager.getCurrentTerminal();
    
    expect(currentTerminal).toBeTruthy();
    expect(manager.terminals.get(terminalId)).toBe(currentTerminal);
  });

  it('should set working directory for all terminals', async () => {
    const terminal1 = await manager.createNewTerminal();
    const terminal2 = await manager.createNewTerminal();

    manager.setWorkingDirectory('/test/path');

    expect(manager.currentWorkingDirectory).toBe('/test/path');
    // Check that terminals received the working directory
    expect(manager.terminals.get(terminal1).workingDirectory).toBe('/test/path');
    expect(manager.terminals.get(terminal2).workingDirectory).toBe('/test/path');
  });

  it('should focus current terminal', async () => {
    // Create a terminal first
    await manager.createNewTerminal();
    
    // Mock XTerm focus method
    const currentTerminal = manager.getCurrentTerminal();
    if (currentTerminal && currentTerminal.xterm) {
      currentTerminal.xterm.focus = vi.fn();
    }

    manager.focus();
    
    // Check that the current terminal is marked as active
    expect(currentTerminal.isActive).toBe(true);
  });
});