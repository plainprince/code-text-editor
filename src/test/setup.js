// Test setup file
import { vi } from 'vitest';

// Mock Tauri API
global.window = global.window || {};
global.window.__TAURI__ = {
  core: {
    invoke: vi.fn().mockResolvedValue('mock-session-id'),
    transformCallback: vi.fn(),
  },
  event: {
    listen: vi.fn(() => Promise.resolve(() => {})), // Return a promise that resolves to an unlisten function
    emit: vi.fn(),
  },
};

// Mock the Tauri invoke function more specifically
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('mock-session-id'),
}));

// Mock the Tauri event system
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

// Mock CodeMirror (if needed for tests)
vi.mock('@codemirror/view', () => ({
  EditorView: class MockEditorView {
    constructor() {
      this.state = { doc: { toString: () => '' } };
    }
    destroy() {}
    focus() {}
    dispatch() {}
  },
  lineNumbers: () => [],
  highlightActiveLineGutter: () => [],
  highlightSpecialChars: () => [],
  drawSelection: () => [],
  dropCursor: () => [],
  rectangularSelection: () => [],
  keymap: { of: () => [] }
}));

// Mock XTerm
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => ({
    open: vi.fn(),
    write: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    focus: vi.fn(),
    onData: vi.fn(),
    loadAddon: vi.fn(),
    refresh: vi.fn(),
    cols: 80,
    rows: 24,
    options: {},
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: vi.fn(),
  })),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock settings
global.window.settings = {
  terminal: {
    font: { family: 'monospace', size: 14 },
    cursor: { blink: true, style: 'block' },
    theme: { background: '#1e1e1e', foreground: '#ffffff' },
  },
};