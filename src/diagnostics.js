// diagnostics.js - Project diagnostics via LSP servers

import { readFile } from './file-system.js';
import { 
  checkCommandExists, 
  startLanguageServer, 
  sendLspRequest, 
  sendLspNotification,
  listenToLspMessages,
  shutdownAllLanguageServers,
  getAppSupportDir,
  runCommand
} from './tauri-helpers.js';
import lsDepManager from './language-server-dep-manager.js';
import { LSPClient } from 'ts-lsp-client';

class DiagnosticsManager {
  constructor(fileExplorer) {
    this.fileExplorer = fileExplorer;
    this.debugMode = false;
    this.activeLanguageServers = new Map(); // language -> { processId, client, initialized }
    this.languageServers = new Map();
    this.openDocuments = new Set();
    this.lspResponses = new Map();
    this.refreshInProgress = false;
    
    // Bind methods
    this.refresh = this.refresh.bind(this);
    this.handleLspMessage = this.handleLspMessage.bind(this);
    
    this.setupLanguageServers();
  }

  log(...args) {
    if (this.debugMode) {
      console.log('[DiagnosticsManager]', ...args);
    }
  }

  error(...args) {
    console.error('[DiagnosticsManager ERROR]', ...args);
  }

  async init() {
    await lsDepManager.initialize();
    this.setupEventListeners();
    this.log('DiagnosticsManager initialized');
    
    // Listen for LSP messages from backend
    try {
      await listenToLspMessages((event) => {
        if (event.event === 'lsp_log_line') {
          this.lspLogHandler(event.payload);
        }
      });
    } catch (error) {
      this.error('Failed to listen to LSP messages:', error);
    }
  }

  lspLogHandler(line) {
    console.log('[Diagnostics LSP Server Logs]', line);
  }

  setupEventListeners() {
    // Listen for file changes
    window.addEventListener('fileChanged', this.refresh);
    
    // Listen for file opens
    window.addEventListener('fileOpened', this.refresh);
  }

  setupLanguageServers() {
    this.languageServers.set('js', {
      name: 'ESLint',
      command: 'eslint',
      args: ['--no-eslintrc', '-f', 'json'],
      type: 'global',
      extensions: ['.js', '.jsx'],
      installCommand: 'npm install -g eslint',
      description: 'ESLint CLI diagnostics for JavaScript/TypeScript'
    });
    this.languageServers.set('ts', {
        name: 'ESLint',
        command: 'eslint',
        args: ['--no-eslintrc', '-f', 'json'],
        type: 'global',
        extensions: ['.ts', '.tsx'],
        installCommand: 'npm install -g eslint',
        description: 'ESLint CLI diagnostics for JavaScript/TypeScript'
    });
    this.languageServers.set('py', {
      name: 'Pylsp',
      command: 'pylsp',
      args: [],
      type: 'global',
      extensions: ['.py'],
      installCommand: 'pip install python-lsp-server',
      description: 'Python language server'
    });
    this.languageServers.set('rs', {
      name: 'Rust Analyzer',
      command: 'rust-analyzer',
      args: [],
      type: 'global',
      extensions: ['.rs'],
      installCommand: 'rustup component add rust-analyzer',
      description: 'Rust language server'
    });
    this.languageServers.set('go', {
      name: 'Gopls',
      command: 'gopls',
      args: [],
      type: 'global',
      extensions: ['.go'],
      installCommand: 'go install golang.org/x/tools/gopls@latest',
      description: 'Go language server'
    });
  }

  async checkServerAvailability(serverInfo, forceRefresh = false) {
    if (serverInfo.type === 'npm') {
        const installed = await lsDepManager.ensureServerInstalled(serverInfo.command, serverInfo.npmPackage);
        if (installed) {
            // Overwrite the command with the full path to the local executable
            serverInfo.command = lsDepManager.getServerExecutablePath(serverInfo.command);
            this.log(`Using locally installed server at: ${serverInfo.command}`);
        }
        return installed;
    }
    
    // For global servers, check if command exists
    try {
      const exists = await checkCommandExists(serverInfo.command);
      this.log(`Server availability:`, exists);
      return exists;
    } catch (error) {
      this.error('Failed to check server availability:', error);
      return false;
    }
  }

  async ensureLanguageServerRunning(serverInfo, language) {
    // Check if already running
    if (this.activeLanguageServers.has(language)) {
      const server = this.activeLanguageServers.get(language);
      if (server.initialized) {
        this.log(`Language server already running and initialized for: ${language}`);
        return server.processId;
      }
    }

    // Determine root URI
    let rootUri = null;
    if (this.fileExplorer && this.fileExplorer.rootFolder) {
      rootUri = `file://${this.fileExplorer.rootFolder}`;
    } else if (window.currentFilePath) {
      const dir = window.currentFilePath.substring(0, window.currentFilePath.lastIndexOf('/'));
      rootUri = `file://${dir}`;
    }

    if (!rootUri) {
      this.log('Cannot start language server: No workspace is open.');
      return null;
    }

    try {
      this.log(`Starting language server: ${serverInfo.command}`, serverInfo.args);
      
      // Start the language server process
      const processId = await startLanguageServer(
        serverInfo.command,
        serverInfo.args,
        language
      );
      
      if (!processId) {
        this.error('Failed to start language server');
        return null;
      }

      this.log(`Language server started with process ID: ${processId}`);

      // Create LSP client
      const client = new LSPClient({
        serverUri: `file://${rootUri}`,
        rootUri: rootUri,
        workspaceFolders: [{ uri: rootUri, name: 'workspace' }],
        capabilities: {
          textDocument: {
            publishDiagnostics: {},
            synchronization: {
              didSave: true,
              willSave: true,
              willSaveWaitUntil: true
            }
          }
        }
      });

      // Initialize the client
      await client.initialize();
      await client.initialized();

      // Store the server info
      this.activeLanguageServers.set(language, {
        processId,
        client,
        initialized: true
      });

      this.log(`Language server initialized for: ${language}`);
      return processId;

    } catch (error) {
      this.error('Failed to start or initialize language server:', error);
      return null;
    }
  }

  async readFileContent(filePath) {
    try {
      this.log(`Reading file content for: ${filePath}`);
      this.log(`Using file-system.js to read file: ${filePath}`);
      
      const content = await readFile(filePath);
      this.log(`File read successfully, content length: ${content.length}`);
      return content;
    } catch (error) {
      this.error(`Failed to read file content for ${filePath}:`, error);
      return null;
    }
  }

  async getRealDiagnostics(filePath, language) {
    const ext = this.getFileExtension(filePath);
    const serverInfo = this.getLanguageServerForExtension(ext);
    
    if (!serverInfo) {
      this.log(`No language server configured for extension: ${ext}`);
      return [];
    }

    const isAvailable = await this.checkServerAvailability(serverInfo);
    if (!isAvailable) {
      this.log('Language server not available, attempting auto-install');
      try {
        if (serverInfo.type === 'npm') {
          await lsDepManager.ensureServerInstalled(serverInfo.command, serverInfo.npmPackage);
        }
      } catch (error) {
        this.error('Auto-install failed:', error);
        this.log('Auto-install failed, showing install instructions');
        this.showInstallInstructionsForFile(serverInfo, ext);
        return [];
      }
    }

    this.log(`Collecting diagnostics for:`, { filePath, serverInfo, language });

    // JS/TS via ESLint CLI (no LSP)
    if (serverInfo.name === 'ESLint' && serverInfo.command === 'eslint') {
      const content = await this.readFileContent(filePath);
      if (!content) return [];
      try {
        const cwd = filePath.substring(0, filePath.lastIndexOf('/')) || process.cwd();
        const output = await window.tauri.core.invoke('run_command', { command: 'eslint', args: ['--no-eslintrc', '-f','json', filePath], cwd });
        const parsed = JSON.parse(output);
        const issues = (parsed[0]?.messages || []).map(m => ({
          severity: m.severity === 2 ? 'error' : 'warning',
          message: m.message,
          line: m.line || 1,
          character: m.column || 1,
          source: 'eslint'
        }));
        return issues;
      } catch (e) {
        this.error('ESLint run failed:', e);
        return [];
      }
    }

    // LSP path (rust, etc.)
    const server = this.activeLanguageServers.get(language);
    if (!server || !server.client) {
      this.log('No active LSP client for language:', language);
      return [];
    }

    try {
      // Open document if not already open
      if (!this.openDocuments.has(filePath)) {
        const content = await this.readFileContent(filePath);
        if (!content) return [];
        
        await server.client.openDocument(filePath, language, content);
        this.openDocuments.add(filePath);
        this.log(`Document opened: ${filePath}`);
      }

      // Request diagnostics
      const diagnostics = await server.client.documentDiagnostics(filePath);
      this.log('LSP diagnostics received:', diagnostics);
      
      return diagnostics.map(d => ({
        severity: d.severity,
        message: d.message,
        line: d.range.start.line + 1,
        character: d.range.start.character + 1,
        source: serverInfo.name
      }));

    } catch (error) {
      this.error('Failed to get LSP diagnostics:', error);
      return [];
    }
  }

  getFileExtension(filePath) {
    const lastDotIndex = filePath.lastIndexOf('.');
    return lastDotIndex !== -1 ? filePath.substring(lastDotIndex + 1) : '';
  }

  getLanguageServerForExtension(ext) {
    return this.languageServers.get(ext);
  }

  showInstallInstructionsForFile(serverInfo, ext) {
    const diagnosticsContent = document.getElementById('diagnostics-content');
    if (!diagnosticsContent) return;

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="install-instructions">
        <h3>Language Server Not Found</h3>
        <p>To get diagnostics for .${ext} files, install <strong>${serverInfo.name}</strong>:</p>
        <div class="install-commands">
          <code>${serverInfo.installCommand}</code>
        </div>
        <p class="install-description">${serverInfo.description}</p>
        <div class="retry-section">
          <button id="install-automatically-btn" class="install-button">
            Install automatically
          </button>
          <button id="retry-diagnostics-btn" class="retry-button">
            Check Again
          </button>
        </div>
      </div>
    `;

    const installBtn = document.getElementById('install-automatically-btn');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        this.updateStatus(`Installing ${serverInfo.name}...`);
        try {
          if (serverInfo.type === 'npm') {
            await lsDepManager.ensureServerInstalled(serverInfo.command, serverInfo.npmPackage);
          }
          this.log(`${serverInfo.name} installed successfully.`);
          this.forceRefresh();
        } catch (error) {
          this.error(`Failed to automatically install ${serverInfo.name}:`, error);
          this.updateStatus(`Failed to install ${serverInfo.name}`);
        }
      });
    }

    const retryBtn = document.getElementById('retry-diagnostics-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.forceRefresh();
      });
    }

    diagnosticsContent.innerHTML = '';
    diagnosticsContent.appendChild(content);
  }

  async refresh(filePath = null) {
    if (this.refreshInProgress) {
      this.log('Refresh already in progress, skipping');
      return;
    }

    this.refreshInProgress = true;

    try {
      const targetPath = filePath || window.currentFilePath;
      this.log(`Refreshing diagnostics for file: ${targetPath}`);
      this.log(`window.currentFilePath: ${window.currentFilePath}`);
      this.log(`Available window properties:`, Object.keys(window).filter(k => k.includes('file')));

      if (!targetPath) {
        this.log('No file open, showing empty diagnostics');
        this.renderDiagnostics([]);
        return;
      }

      const ext = this.getFileExtension(targetPath);
      const language = this.getLanguageFromExtension(ext);
      this.log(`File extension: ${ext} Language: ${language}`);

      const serverInfo = this.getLanguageServerForExtension(ext);
      if (!serverInfo) {
        this.log(`No language server configured for extension: ${ext}`);
        this.renderDiagnostics([]);
        return;
      }

      this.log(`Found server info:`, serverInfo);

      const isAvailable = await this.checkServerAvailability(serverInfo);
      this.log(`Server availability: ${isAvailable}`);

      if (!isAvailable) {
        this.showInstallInstructionsForFile(serverInfo, ext);
        return;
      }

      this.log(`Collecting diagnostics for:`, { filePath: targetPath, serverInfo, language });

      const diagnostics = await this.getRealDiagnostics(targetPath, language);
      this.log(`Retrieved real diagnostics: ${diagnostics.length} items`);

      this.log(`Final diagnostics count for file: ${diagnostics.length}`);
      this.renderDiagnostics(diagnostics);

    } catch (error) {
      this.error('Failed to refresh diagnostics:', error);
      this.renderDiagnostics([]);
    } finally {
      this.refreshInProgress = false;
    }
  }

  getLanguageFromExtension(ext) {
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go'
    };
    return languageMap[ext] || ext;
  }

  renderDiagnostics(diagnostics) {
    const diagnosticsContent = document.getElementById('diagnostics-content');
    if (!diagnosticsContent) return;

    if (diagnostics.length === 0) {
      diagnosticsContent.innerHTML = '<div class="no-issues">Ready (no issues found)</div>';
      this.updateStatus('Ready');
      return;
    }

    const content = document.createElement('div');
    content.className = 'diagnostics-list';

    diagnostics.forEach((diagnostic, index) => {
      const item = document.createElement('div');
      item.className = `diagnostic-item ${diagnostic.severity}`;
      item.innerHTML = `
        <div class="diagnostic-header">
          <span class="diagnostic-severity ${diagnostic.severity}">${diagnostic.severity}</span>
          <span class="diagnostic-location">Line ${diagnostic.line}, Col ${diagnostic.character}</span>
          <span class="diagnostic-source">${diagnostic.source}</span>
        </div>
        <div class="diagnostic-message">${diagnostic.message}</div>
      `;
      content.appendChild(item);
    });

    diagnosticsContent.innerHTML = '';
    diagnosticsContent.appendChild(content);
    this.updateStatus(`${diagnostics.length} issue${diagnostics.length !== 1 ? 's' : ''} found`);
  }

  updateStatus(status) {
    const statusElement = document.getElementById('diagnostics-status');
    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  forceRefresh() {
    this.refresh();
  }

  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    this.log(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`);
  }

  async testWithSampleDiagnostics() {
    this.log('Testing with sample diagnostics');
    const sampleDiagnostics = [
      {
        severity: 'error',
        message: 'Sample error message',
        line: 1,
        character: 1,
        source: 'test'
      },
      {
        severity: 'warning',
        message: 'Sample warning message',
        line: 2,
        character: 5,
        source: 'test'
      }
    ];
    this.renderDiagnostics(sampleDiagnostics);
    this.log('Sample diagnostics applied:', sampleDiagnostics);
  }

  getDebugInfo() {
    return {
      debugMode: this.debugMode,
      activeLanguageServers: Array.from(this.activeLanguageServers.keys()),
      openDocuments: Array.from(this.openDocuments),
      languageServers: Array.from(this.languageServers.entries())
    };
  }

  printDebugInfo() {
    const info = this.getDebugInfo();
    console.log('DiagnosticsManager Debug Info:', info);
  }
}

// Global instance
let diagnosticsManager = null;

export function initDiagnostics(fileExplorer) {
  diagnosticsManager = new DiagnosticsManager(fileExplorer);
  return diagnosticsManager.init();
}

export function refreshDiagnostics(filePath) {
  if (diagnosticsManager) {
    return diagnosticsManager.refresh(filePath);
  }
}

export function toggleDebugMode() {
  if (diagnosticsManager) {
    diagnosticsManager.toggleDebugMode();
  }
}

export function testWithSampleDiagnostics() {
  if (diagnosticsManager) {
    diagnosticsManager.testWithSampleDiagnostics();
  }
}

export function getDebugInfo() {
  if (diagnosticsManager) {
    return diagnosticsManager.getDebugInfo();
  }
  return null;
}

export function printDebugInfo() {
  if (diagnosticsManager) {
    diagnosticsManager.printDebugInfo();
  }
}

// Cleanup on app close
window.addEventListener('beforeunload', () => {
  if (diagnosticsManager) {
    shutdownAllLanguageServers();
  }
});
export default DiagnosticsManager;