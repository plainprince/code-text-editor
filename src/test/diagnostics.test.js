// diagnostics.test.js - Tests for file-scoped diagnostics

import { describe, it, expect, beforeEach, vi } from 'vitest';
import DiagnosticsManager from '../diagnostics.js';

describe('DiagnosticsManager', () => {
  let manager;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Mock DOM elements
    document.body.innerHTML = `
      <div id="diagnostics-content"></div>
      <div id="diagnostics-status"></div>
      <button id="diagnostics-refresh"></button>
    `;

    // Mock Tauri API
    global.window = global.window || {};
    global.window.__TAURI__ = {
      core: {
        invoke: vi.fn().mockResolvedValue(true),
      },
    };

    // Mock currentFilePath
    global.window.currentFilePath = null;

    manager = new DiagnosticsManager();
  });

  it('should initialize with empty diagnostics', () => {
    expect(manager.diagnostics.size).toBe(0);
    expect(manager.isRefreshing).toBe(false);
  });

  it('should get file extension correctly', () => {
    expect(manager.getFileExtension('test.js')).toBe('js');
    expect(manager.getFileExtension('test.ts')).toBe('ts');
    expect(manager.getFileExtension('test.py')).toBe('py');
    expect(manager.getFileExtension('test')).toBe(null);
  });

  it('should find language server for extension', () => {
    const jsServer = manager.getLanguageServerForExtension('js');
    expect(jsServer).not.toBeNull();
    expect(jsServer.name).toBe('TypeScript Language Server');

    const unknownServer = manager.getLanguageServerForExtension('unknown');
    expect(unknownServer).toBeNull();
  });



  it('should handle refresh with no file open', async () => {
    global.window.currentFilePath = null;
    
    await manager.refresh();
    
    expect(manager.isRefreshing).toBe(false);
    const status = document.getElementById('diagnostics-status');
    expect(status.textContent).toBe('No file open');
  });

  it('should handle refresh with JavaScript file', async () => {
    global.window.currentFilePath = '/test/file.js';
    
    await manager.refresh();
    
    expect(manager.diagnostics.has('/test/file.js')).toBe(true);
    const diagnostics = manager.diagnostics.get('/test/file.js');
    expect(Array.isArray(diagnostics)).toBe(true);
  });

  it('should show install instructions for unavailable server', async () => {
    global.window.currentFilePath = '/test/file.js';
    global.window.__TAURI__.core.invoke.mockResolvedValue(false); // Server not available
    
    await manager.refresh();
    
    const content = document.getElementById('diagnostics-content');
    expect(content.innerHTML).toContain('Language Server Not Found');
    expect(content.innerHTML).toContain('TypeScript Language Server');
  });

  it('should count diagnostics for file correctly', () => {
    manager.diagnostics.set('/test/file.js', [
      { severity: 'error', message: 'Test error' },
      { severity: 'warning', message: 'Test warning' }
    ]);
    
    expect(manager.getFileDiagnosticsCount('/test/file.js')).toBe(2);
    expect(manager.getFileDiagnosticsCount('/test/nonexistent.js')).toBe(0);
  });

  it('should render empty diagnostics when no issues', () => {
    manager.renderEmptyDiagnostics();
    
    const content = document.getElementById('diagnostics-content');
    expect(content.innerHTML).toContain('No diagnostics available');
  });
});