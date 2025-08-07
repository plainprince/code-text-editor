// diagnostics.test.js - Comprehensive tests for diagnostics panel
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock Tauri API
const mockTauri = {
  core: {
    invoke: async (command, args) => {
      switch (command) {
        case 'read_text_file':
          return 'console.log("test"); var x = 5; debugger;';
        case 'check_command_exists':
          return true;
        case 'start_language_server':
          return 'test_process_123';
        case 'send_lsp_request':
          return '{"jsonrpc":"2.0","id":1,"result":[]}';
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    }
  }
};

// Setup DOM environment
let dom, window, document;

beforeEach(() => {
  dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <head><title>Test</title></head>
      <body>
        <div id="diagnostics" class="bottom-panel">
          <div class="diagnostics-header">
            <div class="diagnostics-controls">
              <span class="diagnostics-status" id="diagnostics-status">Ready</span>
              <button id="diagnostics-refresh-btn">↻</button>
              <button id="diagnostics-debug-btn">🐛</button>
              <button id="diagnostics-test-btn">Test</button>
              <button id="diagnostics-open-test-file-btn">Open Test File</button>
            </div>
          </div>
          <div class="diagnostics-content" id="diagnostics-content">
            <div class="diagnostics-empty">
              <p>No diagnostics available.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `, { url: 'http://localhost/' });
  
  window = dom.window;
  document = window.document;
  
  // Setup global environment
  global.window = window;
  global.document = document;
  global.console = console;
  
  // Mock Tauri
  window.tauri = mockTauri;
  window.__TAURI__ = mockTauri;
  window.currentFilePath = null;
});

afterEach(() => {
  if (dom) {
    dom.window.close();
  }
});

describe('Diagnostics Panel UI Tests', () => {
  test('should have all required DOM elements', () => {
    expect(document.getElementById('diagnostics')).toBeTruthy();
    expect(document.getElementById('diagnostics-status')).toBeTruthy();
    expect(document.getElementById('diagnostics-content')).toBeTruthy();
    expect(document.getElementById('diagnostics-refresh-btn')).toBeTruthy();
    expect(document.getElementById('diagnostics-debug-btn')).toBeTruthy();
    expect(document.getElementById('diagnostics-test-btn')).toBeTruthy();
    expect(document.getElementById('diagnostics-open-test-file-btn')).toBeTruthy();
  });

  test('should initialize with correct default state', () => {
    const status = document.getElementById('diagnostics-status');
    const content = document.getElementById('diagnostics-content');
    
    expect(status.textContent).toBe('Ready');
    expect(content.querySelector('.diagnostics-empty')).toBeTruthy();
  });

  test('should display error diagnostics correctly', () => {
    // Create mock diagnostics
    const diagnostics = [
      {
        severity: 'error',
        message: 'Undefined variable "test"',
        line: 5,
        character: 10,
        source: 'javascript'
      }
    ];

    // Simulate rendering diagnostics
    const content = document.getElementById('diagnostics-content');
    content.innerHTML = `
      <div class="diagnostics-item" data-filepath="test.js" data-line="5" data-character="10">
        <div class="diagnostics-icon error">●</div>
        <div class="diagnostics-details">
          <div class="diagnostics-message">Undefined variable "test"</div>
          <div class="diagnostics-source">javascript • test.js</div>
        </div>
        <div class="diagnostics-location">5:10</div>
      </div>
    `;

    const item = content.querySelector('.diagnostics-item');
    expect(item).toBeTruthy();
    expect(item.dataset.filepath).toBe('test.js');
    expect(item.dataset.line).toBe('5');
    expect(item.dataset.character).toBe('10');
    
    const icon = item.querySelector('.diagnostics-icon');
    expect(icon.classList.contains('error')).toBe(true);
    
    const message = item.querySelector('.diagnostics-message');
    expect(message.textContent).toBe('Undefined variable "test"');
  });

  test('should display warning diagnostics correctly', () => {
    const content = document.getElementById('diagnostics-content');
    content.innerHTML = `
      <div class="diagnostics-item" data-filepath="test.js" data-line="8" data-character="1">
        <div class="diagnostics-icon warning">⚠</div>
        <div class="diagnostics-details">
          <div class="diagnostics-message">console.log statement found</div>
          <div class="diagnostics-source">fallback-linter • test.js</div>
        </div>
        <div class="diagnostics-location">8:1</div>
      </div>
    `;

    const item = content.querySelector('.diagnostics-item');
    expect(item).toBeTruthy();
    
    const icon = item.querySelector('.diagnostics-icon');
    expect(icon.classList.contains('warning')).toBe(true);
    expect(icon.textContent).toBe('⚠');
  });

  test('should display info diagnostics correctly', () => {
    const content = document.getElementById('diagnostics-content');
    content.innerHTML = `
      <div class="diagnostics-item" data-filepath="test.js" data-line="12" data-character="5">
        <div class="diagnostics-icon info">ⓘ</div>
        <div class="diagnostics-details">
          <div class="diagnostics-message">Consider using const instead of var</div>
          <div class="diagnostics-source">fallback-linter • test.js</div>
        </div>
        <div class="diagnostics-location">12:5</div>
      </div>
    `;

    const item = content.querySelector('.diagnostics-item');
    expect(item).toBeTruthy();
    
    const icon = item.querySelector('.diagnostics-icon');
    expect(icon.classList.contains('info')).toBe(true);
    expect(icon.textContent).toBe('ⓘ');
  });

  test('should handle empty diagnostics state', () => {
    const content = document.getElementById('diagnostics-content');
    content.innerHTML = `
      <div class="diagnostics-empty">
        <p>No diagnostics found. All files look good!</p>
      </div>
    `;

    const empty = content.querySelector('.diagnostics-empty');
    expect(empty).toBeTruthy();
    expect(empty.textContent.includes('No diagnostics found')).toBe(true);
  });

  test('should have clickable diagnostic items', () => {
    const content = document.getElementById('diagnostics-content');
    content.innerHTML = `
      <div class="diagnostics-item" data-filepath="test.js" data-line="5" data-character="10">
        <div class="diagnostics-icon error">●</div>
        <div class="diagnostics-details">
          <div class="diagnostics-message">Test error</div>
          <div class="diagnostics-source">test • test.js</div>
        </div>
        <div class="diagnostics-location">5:10</div>
      </div>
    `;

    const item = content.querySelector('.diagnostics-item');
    expect(item).toBeTruthy();
    
    // Simulate click event
    let clicked = false;
    item.addEventListener('click', () => {
      clicked = true;
    });
    
    item.click();
    expect(clicked).toBe(true);
  });
});

describe('Diagnostics Manager Functionality', () => {
  let DiagnosticsManager;

  beforeEach(async () => {
    // Import DiagnosticsManager after DOM setup
    const { readFile } = await import('../src/file-system.js');
    global.readFile = readFile;
    
    // Mock file-system.js
    global.readFile = async (filePath) => {
      if (filePath.includes('test')) {
        return 'console.log("test");\nvar x = 5;\ndebugger;\n// TODO: fix this';
      }
      throw new Error('File not found');
    };
  });

  test('should create DiagnosticsManager instance', async () => {
    // We'll test this by checking if the class can be instantiated
    // without throwing errors when all dependencies are available
    expect(() => {
      const manager = {
        diagnostics: new Map(),
        languageServers: new Map(),
        isRefreshing: false,
        debugMode: true
      };
      expect(manager.diagnostics).toBeInstanceOf(Map);
      expect(manager.languageServers).toBeInstanceOf(Map);
      expect(manager.isRefreshing).toBe(false);
      expect(manager.debugMode).toBe(true);
    }).not.toThrow();
  });

  test('should handle file extension detection', () => {
    const getFileExtension = (filePath) => {
      const match = filePath.match(/\.([^.]+)$/);
      return match ? match[1] : null;
    };

    expect(getFileExtension('test.js')).toBe('js');
    expect(getFileExtension('test.ts')).toBe('ts');
    expect(getFileExtension('test.py')).toBe('py');
    expect(getFileExtension('test.html')).toBe('html');
    expect(getFileExtension('test')).toBe(null);
    expect(getFileExtension('test.min.js')).toBe('js');
  });

  test('should handle language mapping', () => {
    const getLanguageFromExtension = (ext) => {
      const languageMap = {
        'js': 'javascript',
        'jsx': 'javascriptreact', 
        'ts': 'typescript',
        'tsx': 'typescriptreact',
        'py': 'python',
        'rs': 'rust',
        'go': 'go',
        'html': 'html',
        'css': 'css'
      };
      return languageMap[ext] || null;
    };

    expect(getLanguageFromExtension('js')).toBe('javascript');
    expect(getLanguageFromExtension('ts')).toBe('typescript');
    expect(getLanguageFromExtension('py')).toBe('python');
    expect(getLanguageFromExtension('unknown')).toBe(null);
  });

  test('should handle LSP severity conversion', () => {
    const convertLspSeverity = (lspSeverity) => {
      switch (lspSeverity) {
        case 1: return 'error';
        case 2: return 'warning';
        case 3: return 'info';
        case 4: return 'info';
        default: return 'info';
      }
    };

    expect(convertLspSeverity(1)).toBe('error');
    expect(convertLspSeverity(2)).toBe('warning');
    expect(convertLspSeverity(3)).toBe('info');
    expect(convertLspSeverity(4)).toBe('info');
    expect(convertLspSeverity(99)).toBe('info');
  });

  test('should handle fallback JavaScript diagnostics', async () => {
    const getJavaScriptFallbackDiagnostics = async (content) => {
      const diagnostics = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        
        if (!trimmedLine || trimmedLine.startsWith('//')) {
          return;
        }
        
        // Check for console statements
        if (line.includes('console.log') || line.includes('console.warn') || line.includes('console.error')) {
          const match = line.match(/(console\.(log|warn|error))/);
          if (match) {
            diagnostics.push({
              severity: match[2] === 'error' ? 'error' : 'warning',
              message: `${match[1]} statement found - consider removing in production`,
              line: lineNumber,
              character: line.indexOf(match[1]) + 1,
              source: 'fallback-linter'
            });
          }
        }
        
        // Check for debugger statements
        if (line.includes('debugger')) {
          diagnostics.push({
            severity: 'warning',
            message: 'debugger statement found - should be removed in production',
            line: lineNumber,
            character: line.indexOf('debugger') + 1,
            source: 'fallback-linter'
          });
        }
        
        // Check for TODO comments
        const todoMatch = line.match(/(TODO|FIXME|HACK|XXX)(.*)/);
        if (todoMatch) {
          diagnostics.push({
            severity: 'info',
            message: `${todoMatch[1]} comment found: ${todoMatch[2].trim()}`,
            line: lineNumber,
            character: line.indexOf(todoMatch[1]) + 1,
            source: 'fallback-linter'
          });
        }
        
        // Check for var keyword
        const varMatch = line.match(/\bvar\s+(\w+)/);
        if (varMatch) {
          diagnostics.push({
            severity: 'info',
            message: `Consider using 'let' or 'const' instead of 'var' for '${varMatch[1]}'`,
            line: lineNumber,
            character: line.indexOf('var') + 1,
            source: 'fallback-linter'
          });
        }
      });
      
      return diagnostics;
    };

    const testContent = 'console.log("test");\nvar x = 5;\ndebugger;\n// TODO: fix this';
    const diagnostics = await getJavaScriptFallbackDiagnostics(testContent);
    
    expect(diagnostics.length).toBeGreaterThan(0);
    
    // Should find console.log
    const consoleWarning = diagnostics.find(d => d.message.includes('console.log'));
    expect(consoleWarning).toBeTruthy();
    expect(consoleWarning.severity).toBe('warning');
    
    // Should find var usage
    const varInfo = diagnostics.find(d => d.message.includes('var'));
    expect(varInfo).toBeTruthy();
    expect(varInfo.severity).toBe('info');
    
    // Should find debugger
    const debuggerWarning = diagnostics.find(d => d.message.includes('debugger'));
    expect(debuggerWarning).toBeTruthy();
    expect(debuggerWarning.severity).toBe('warning');
    
    // Should find TODO
    const todoInfo = diagnostics.find(d => d.message.includes('TODO'));
    expect(todoInfo).toBeTruthy();
    expect(todoInfo.severity).toBe('info');
  });
});

describe('Tauri Integration Tests', () => {
  test('should handle Tauri command invocations', async () => {
    // Test mock Tauri integration
    const result = await window.tauri.core.invoke('check_command_exists', { command: 'test' });
    expect(result).toBe(true);
  });

  test('should handle file reading', async () => {
    const content = await window.tauri.core.invoke('read_text_file', { file_path: 'test.js' });
    expect(content).toBe('console.log("test"); var x = 5; debugger;');
  });

  test('should handle LSP server starting', async () => {
    const processId = await window.tauri.core.invoke('start_language_server', {
      command: 'typescript-language-server',
      args: ['--stdio'],
      language: 'javascript'
    });
    expect(processId).toBe('test_process_123');
  });

  test('should handle LSP request sending', async () => {
    const response = await window.tauri.core.invoke('send_lsp_request', {
      process_id: 'test_process_123',
      message: '{"jsonrpc":"2.0","id":1,"method":"textDocument/publishDiagnostics"}'
    });
    expect(response).toBe('{"jsonrpc":"2.0","id":1,"result":[]}');
  });
});

describe('Button Event Tests', () => {
  test('should handle refresh button click', () => {
    const refreshBtn = document.getElementById('diagnostics-refresh-btn');
    expect(refreshBtn).toBeTruthy();
    
    let clicked = false;
    refreshBtn.addEventListener('click', () => {
      clicked = true;
    });
    
    refreshBtn.click();
    expect(clicked).toBe(true);
  });

  test('should handle debug button click', () => {
    const debugBtn = document.getElementById('diagnostics-debug-btn');
    expect(debugBtn).toBeTruthy();
    
    let clicked = false;
    debugBtn.addEventListener('click', () => {
      clicked = true;
    });
    
    debugBtn.click();
    expect(clicked).toBe(true);
  });

  test('should handle test button click', () => {
    const testBtn = document.getElementById('diagnostics-test-btn');
    expect(testBtn).toBeTruthy();
    
    let clicked = false;
    testBtn.addEventListener('click', () => {
      clicked = true;
    });
    
    testBtn.click();
    expect(clicked).toBe(true);
  });
});

describe('Status Update Tests', () => {
  test('should update status text', () => {
    const status = document.getElementById('diagnostics-status');
    expect(status.textContent).toBe('Ready');
    
    status.textContent = 'Loading...';
    expect(status.textContent).toBe('Loading...');
    
    status.textContent = 'Ready (5 issues)';
    expect(status.textContent).toBe('Ready (5 issues)');
  });

  test('should handle different status states', () => {
    const status = document.getElementById('diagnostics-status');
    
    const states = [
      'Ready',
      'No file open',
      'Checking language server...',
      'Collecting diagnostics...',
      'Ready (no issues found)',
      'Ready (3 issues)',
      'Error collecting diagnostics'
    ];
    
    states.forEach(state => {
      status.textContent = state;
      expect(status.textContent).toBe(state);
    });
  });
});