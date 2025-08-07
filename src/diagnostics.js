// diagnostics.js - Project diagnostics via LSP servers

import { readFile } from './file-system.js';
import { 
  checkCommandExists, 
  startLanguageServer, 
  sendLspRequest, 
  sendLspNotification,
  listenToLspMessages
} from './tauri-helpers.js';
import LanguageServerManager from './language-server-manager.js';

class DiagnosticsManager {
  constructor() {
    this.diagnostics = new Map(); // filepath -> diagnostics array
    this.languageServers = new Map(); // file extension -> LSP info
    this.openDocuments = new Set(); // Track which documents are open in LSP
    this.isRefreshing = false;
    this.autoRefreshTimeout = null; // For debouncing auto-refresh
    this.languageServerManager = new LanguageServerManager();
    this.activeLanguageServers = new Map(); // language -> process info
    this.debugMode = true; // Enable debug logging
    this.lspResponses = new Map(); // Store responses from LSP

    // Bind methods to ensure correct `this` context
    this.handleLspMessage = this.handleLspMessage.bind(this);
    this.refresh = this.refresh.bind(this);

    this.init();
  }


  async init() {
    this.setupEventListeners();
    this.setupLanguageServers();
    this.log('DiagnosticsManager initialized');
    
    // Listen for LSP messages from the backend
    await listenToLspMessages(this.handleLspMessage);
    
    // Expose to global scope for debugging
    window.languageServerManager = this.languageServerManager;
    window.diagnosticsManager = this;
  }

  
  log(message, ...args) {
    if (this.debugMode) {
      console.log('[DiagnosticsManager]', message, ...args);
    }
  }
  
  error(message, ...args) {
    console.error('[DiagnosticsManager ERROR]', message, ...args);
  }

  handleLspMessage(message) {
    try {
      const parsed = JSON.parse(message);
      if (parsed.id) {
        // This is a response to a request
        this.lspResponses.set(parsed.id, parsed);
      } else if (parsed.method === 'textDocument/publishDiagnostics') {
        // This is a notification
        const diagnostics = this.convertLspDiagnostics(parsed.params.diagnostics);
        this.diagnostics.set(parsed.params.uri.replace('file://', ''), diagnostics);
        this.renderDiagnostics();
      }
    } catch (error) {
      this.error('Failed to handle LSP message:', error);
    }
  }

  
  error(message, ...args) {
    console.error('[DiagnosticsManager ERROR]', message, ...args);
  }

  setupEventListeners() {
    // Auto-refresh when file content changes (if editor supports it)
    document.addEventListener('editor-content-changed', () => {
      // Don't auto-refresh if install instructions are showing
      if (this.isShowingInstallInstructions()) {
        return;
      }
      
      if (this.autoRefreshTimeout) {
        clearTimeout(this.autoRefreshTimeout);
      }
      // Debounce auto-refresh to avoid excessive calls
      this.autoRefreshTimeout = setTimeout(() => {
        this.refresh();
      }, 1000); // 1 second delay after last change
    });
    
    // Refresh when switching between tabs (but allow time for install instructions)
    document.addEventListener('tab-switched', () => {
      // Small delay to avoid immediately overriding install instructions
      setTimeout(() => {
        if (!this.isShowingInstallInstructions()) {
          this.refresh();
        }
      }, 500);
    });
  }

  isShowingInstallInstructions() {
    const content = document.getElementById('diagnostics-content');
    return content && content.querySelector('.install-instructions');
  }

  setupLanguageServers() {
    // Common language servers and their detection
    this.languageServers.set('js', {
      name: 'TypeScript Language Server',
      command: 'typescript-language-server',
      args: ['--stdio'],
      extensions: ['.js', '.jsx'],
      installCommand: {
        npm: 'npm install -g typescript-language-server typescript',
        yarn: 'yarn global add typescript-language-server typescript',
        description: 'JavaScript/TypeScript language server'
      }
    });

    this.languageServers.set('ts', {
      name: 'TypeScript Language Server',
      command: 'typescript-language-server',
      args: ['--stdio'],
      extensions: ['.ts', '.tsx'],
      installCommand: {
        npm: 'npm install -g typescript-language-server typescript',
        yarn: 'yarn global add typescript-language-server typescript',
        description: 'JavaScript/TypeScript language server'
      }
    });

    this.languageServers.set('py', {
      name: 'Pylsp',
      command: 'pylsp',
      args: [],
      extensions: ['.py'],
      installCommand: {
        pip: 'pip install python-lsp-server',
        description: 'Python language server'
      }
    });

    this.languageServers.set('rs', {
      name: 'Rust Analyzer',
      command: 'rust-analyzer',
      args: [],
      extensions: ['.rs'],
      installCommand: {
        rustup: 'rustup component add rust-analyzer',
        description: 'Rust language server'
      }
    });

    this.languageServers.set('go', {
      name: 'Gopls',
      command: 'gopls',
      args: [],
      extensions: ['.go'],
      installCommand: {
        go: 'go install golang.org/x/tools/gopls@latest',
        description: 'Go language server'
      }
    });
  }

  async refresh(filePath = null, forceRefresh = false) {
    if (this.isRefreshing) {
      this.log('Refresh already in progress, skipping');
      return;
    }

    // Get current file if not specified
    if (!filePath) {
      filePath = window.currentFilePath || null;
    }

    this.log('Refreshing diagnostics for file:', filePath);
    this.log('window.currentFilePath:', window.currentFilePath);
    this.log('Available window properties:', Object.keys(window).filter(k => k.includes('File') || k.includes('file') || k.includes('current')));

    if (!filePath) {
      this.log('No file open, showing empty diagnostics');
      this.updateStatus('No file open');
      this.renderEmptyDiagnostics();
      return;
    }

    this.isRefreshing = true;
    this.updateStatus('Checking language server...');

    try {
      // Get file extension and language
      const ext = this.getFileExtension(filePath);
      const language = this.getLanguageFromExtension(ext);
      
      this.log('File extension:', ext, 'Language:', language);
      
      if (!ext || !language) {
        this.log('Unsupported file type:', ext);
        this.updateStatus('Unsupported file type');
        this.renderEmptyDiagnostics();
        return;
      }

      // Check if language server is available for this file type
      const serverInfo = this.getLanguageServerForExtension(ext);
      if (!serverInfo) {
        this.log('No language server configured for extension:', ext);
        this.updateStatus('No language server configured');
        this.renderEmptyDiagnostics();
        return;
      }

      this.log('Found server info:', serverInfo);

      // Check server availability (with optional force refresh)
      const isAvailable = await this.checkServerAvailability(serverInfo, forceRefresh);
      
      this.log('Server availability:', isAvailable);
      
      if (!isAvailable) {
        this.log('Language server not available, showing install instructions');
        this.showInstallInstructionsForFile(serverInfo, ext);
        return;
      }

      this.updateStatus('Collecting diagnostics...');
      
      // Get diagnostics for current file only
      await this.collectFileDiagnostics(filePath, serverInfo, language);
      
      const count = this.getFileDiagnosticsCount(filePath);
      this.log('Final diagnostics count for file:', count);
      
      if (count === 0) {
        this.updateStatus('Ready (no issues found)');
      } else {
        this.updateStatus(`Ready (${count} issues)`);
      }
    } catch (error) {
      this.error('Failed to refresh diagnostics:', error);
      this.updateStatus('Error collecting diagnostics');
    } finally {
      this.isRefreshing = false;
    }
  }

  // Force refresh diagnostics (clears cache first)
  async forceRefresh(filePath = null) {
    this.clearLanguageServerCache();
    await this.refresh(filePath, true);
  }

  async detectLanguageServers() {
    const available = [];
    
    for (const [ext, serverInfo] of this.languageServers) {
      try {
        const isAvailable = await this.checkServerAvailable(serverInfo.command);
        if (isAvailable) {
          available.push({ ext, ...serverInfo });
        }
      } catch (error) {
        console.log(`${serverInfo.name} not available:`, error.message);
      }
    }

    return available;
  }

  getFileExtension(filePath) {
    const match = filePath.match(/\.([^.]+)$/);
    return match ? match[1] : null;
  }
  
  getLanguageFromExtension(ext) {
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascriptreact', 
      'ts': 'typescript',
      'tsx': 'typescriptreact',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'vue': 'vue',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'sh': 'shellscript',
      'bash': 'bash'
    };
    
    return languageMap[ext] || null;
  }

  getLanguageServerForExtension(ext) {
    return this.languageServers.get(ext) || null;
  }

  async checkServerAvailability(serverInfo, forceRefresh = false) {
    // Check cache first (unless forced refresh)
    const cacheKey = `lsp_${serverInfo.command}`;
    if (!forceRefresh) {
      const cached = this.getCachedServerStatus(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Check server availability
    try {
      const result = await checkCommandExists(serverInfo.command);
      this.setCachedServerStatus(cacheKey, result);
      return result;
    } catch (error) {
      this.setCachedServerStatus(cacheKey, false);
      return false;
    }
  }

  getCachedServerStatus(cacheKey) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        // Cache for 5 minutes
        if (Date.now() - data.timestamp < 5 * 60 * 1000) {
          return data.available;
        }
      }
    } catch (error) {
      // Ignore cache errors
    }
    return null;
  }

  setCachedServerStatus(cacheKey, available) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        available,
        timestamp: Date.now()
      }));
    } catch (error) {
      // Ignore cache errors
    }
  }

  // Clear all language server cache
  clearLanguageServerCache() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('lsp_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      // Ignore cache errors
    }
  }

  async checkServerAvailable(command) {
    try {
      // Use Tauri to check if command exists
      const result = await checkCommandExists(command);
      return result;
    } catch (error) {
      return false;
    }
  }

  async collectFileDiagnostics(filePath, serverInfo, language) {
    // Clear all diagnostics to avoid accumulation when switching files
    this.diagnostics.clear();
    
    this.log('Collecting diagnostics for:', { filePath, serverInfo: serverInfo.name, language });
    
    try {
      // Try to get real diagnostics from the language server
      const realDiagnostics = await this.getRealDiagnostics(filePath, serverInfo, language);
      this.diagnostics.set(filePath, realDiagnostics);
    } catch (error) {
      this.error('Could not get diagnostics:', error.message);
      this.diagnostics.set(filePath, []);
    }

    this.renderDiagnostics();
  }
  
  async getRealDiagnostics(filePath, serverInfo, language) {
    this.log('Getting real diagnostics via LSP for:', { filePath, language });
    
    try {
      // Try to start language server if not already running
      const processId = await this.ensureLanguageServerRunning(serverInfo, language);
      
      if (!processId) {
        this.log('Could not start language server');
        return [];
      }
      
      // Read file content
      const fileContent = await this.readFileContent(filePath);
      if (!fileContent) {
        this.log('Could not read file content');
        return [];
      }
      
      // Request diagnostics (this will handle didClose/didOpen internally)
      const diagnostics = await this.requestDiagnostics(processId, filePath, language, fileContent);
      this.log('LSP diagnostics received:', diagnostics);
      
      return diagnostics;
      
    } catch (error) {
      this.error('Failed to get LSP diagnostics:', error);
      return [];
    }
  }
  

  
  async ensureLanguageServerRunning(serverInfo, language) {
    const existing = this.activeLanguageServers.get(language);
    if (existing) {
      this.log('Language server already running for:', language);
      return existing.processId;
    }
    
    try {
      this.log('Starting language server:', serverInfo.command, serverInfo.args);
      
      const processId = await startLanguageServer(serverInfo.command, serverInfo.args, language);
      
      this.activeLanguageServers.set(language, {
        processId,
        serverInfo,
        startTime: Date.now()
      });
      
      this.log('Language server started with process ID:', processId);
      return processId;
      
    } catch (error) {
      this.error('Failed to start language server:', error);
      return null;
    }
  }
  
  async readFileContent(filePath) {
    this.log('Reading file content for:', filePath);
    
    if (!filePath) {
      this.error('readFileContent called with null/undefined filePath');
      return null;
    }
    
    try {
      this.log('Using file-system.js to read file:', filePath);
      const result = await readFile(filePath);
      this.log('File read successfully, content length:', result ? result.length : 0);
      return result;
    } catch (error) {
      this.error('Failed to read file content for', filePath, ':', error);
      return null;
    }
  }
  
  async sendDidOpenNotification(processId, filePath, language, content) {
    const notification = {
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: {
          uri: `file://${filePath}`,
          languageId: language,
          version: 1,
          text: content
        }
      }
    };
    
    try {
      await sendLspNotification(processId, JSON.stringify(notification));
      this.openDocuments.add(filePath);
      this.log('Document opened successfully:', filePath);
    } catch (error) {
      this.error('Failed to send didOpen notification:', error);
      throw error;
    }
  }
  
  async sendDidCloseNotification(processId, filePath) {
    // Only close if we think the document is open
    if (!this.openDocuments.has(filePath)) {
      this.log('Document not tracked as open, skipping didClose for:', filePath);
      return;
    }
    
    const notification = {
      jsonrpc: '2.0',
      method: 'textDocument/didClose',
      params: {
        textDocument: {
          uri: `file://${filePath}`
        }
      }
    };
    
    try {
      await sendLspNotification(processId, JSON.stringify(notification));
      this.openDocuments.delete(filePath);
      this.log('Document closed successfully:', filePath);
    } catch (error) {
      this.log('Note: Failed to send didClose notification:', error);
      // Still remove from tracking even if close failed
      this.openDocuments.delete(filePath);
    }
  }
  
  async requestDiagnostics(processId, filePath, language, content) {
    this.log('Requesting diagnostics via LSP for:', filePath);
    
    try {
      if (this.openDocuments.has(filePath)) {
        this.log('Document already open, sending change notification');
        const changeNotification = {
          jsonrpc: '2.0',
          method: 'textDocument/didChange',
          params: {
            textDocument: {
              uri: `file://${filePath}`,
              version: Date.now()
            },
            contentChanges: [{ text: content }]
          }
        };
        await sendLspNotification(processId, JSON.stringify(changeNotification));
      } else {
        await this.sendDidOpenNotification(processId, filePath, language, content);
      }
      
      const id = Date.now();
      const symbolRequest = {
        jsonrpc: '2.0',
        id,
        method: 'textDocument/documentSymbol',
        params: {
          textDocument: {
            uri: `file://${filePath}`
          }
        }
      };
      
      await sendLspRequest(processId, JSON.stringify(symbolRequest));
      
      // Wait for the response
      for (let i = 0; i < 100; i++) {
        if (this.lspResponses.has(id)) {
          const response = this.lspResponses.get(id);
          this.lspResponses.delete(id);
          return response.result;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      throw new Error('LSP request timeout');
      
    } catch (error) {
      this.error('Failed to request LSP diagnostics:', error);
      return [];
    }
  }
  
  convertLspDiagnostics(lspDiagnostics) {
    return lspDiagnostics.map(diag => ({
      severity: this.convertLspSeverity(diag.severity),
      message: diag.message,
      line: diag.range.start.line + 1, // LSP is 0-based, we use 1-based
      character: diag.range.start.character + 1,
      source: diag.source || 'lsp'
    }));
  }
  
  convertLspSeverity(lspSeverity) {
    // LSP severity: 1=Error, 2=Warning, 3=Information, 4=Hint
    switch (lspSeverity) {
      case 1: return 'error';
      case 2: return 'warning';
      case 3: return 'info';
      case 4: return 'info';
      default: return 'info';
    }
  }

  async collectDiagnostics(availableServers) {
    // This would integrate with LSP servers via the Rust backend
    // For now, show placeholder diagnostics
    this.diagnostics.clear();
    
    // Mock some diagnostics for demonstration
    this.diagnostics.set('example.js', [
      {
        severity: 'error',
        message: 'Unused variable "example"',
        line: 10,
        character: 5,
        source: 'typescript'
      },
      {
        severity: 'warning',
        message: 'Function declared but never used',
        line: 25,
        character: 0,
        source: 'typescript'
      }
    ]);

    this.renderDiagnostics();
  }

  renderEmptyDiagnostics() {
    const content = document.getElementById('diagnostics-content');
    if (!content) return;

    const filePath = window.currentFilePath;
    if (!filePath) {
      content.innerHTML = `
        <div class="diagnostics-empty">
          <p>No file open.</p>
        </div>
      `;
    } else {
      content.innerHTML = `
        <div class="diagnostics-empty">
          <p>No diagnostics found for this file.</p>
          <p class="diagnostics-note">Language server integration is in development.</p>
        </div>
      `;
    }
  }

  getFileDiagnosticsCount(filePath) {
    const diagnostics = this.diagnostics.get(filePath);
    return diagnostics ? diagnostics.length : 0;
  }

  showInstallInstructionsForFile(serverInfo, ext) {
    this.updateStatus(`${serverInfo.name} not installed`);
    const content = document.getElementById('diagnostics-content');
    if (!content) return;

    content.innerHTML = `
      <div class="install-instructions">
        <h3>Language Server Not Found</h3>
        <p>To get diagnostics for .${ext} files, install <strong>${serverInfo.name}</strong>:</p>
        <div class="install-commands">
          <div class="install-option">
            <strong>Using npm:</strong>
            <code>${serverInfo.installCommand.npm}</code>
          </div>
          <div class="install-option">
            <strong>Using yarn:</strong>
            <code>${serverInfo.installCommand.yarn}</code>
          </div>
        </div>
        <p class="install-description">${serverInfo.installCommand.description}</p>
        <div class="retry-section">
          <p class="retry-message">
            After installing the language server, click the button below to check again:
          </p>
          <button id="retry-diagnostics-btn" class="retry-button">
            Check Again
          </button>
        </div>
      </div>
    `;

    // Add click handler for the retry button
    const retryBtn = document.getElementById('retry-diagnostics-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.forceRefresh();
      });
    }
  }

  renderDiagnostics() {
    const content = document.getElementById('diagnostics-content');
    if (!content) return;

    if (this.diagnostics.size === 0) {
      content.innerHTML = `
        <div class="diagnostics-empty">
          <p>No diagnostics found. All files look good!</p>
        </div>
      `;
      return;
    }

    let html = '';
    for (const [filepath, fileDiagnostics] of this.diagnostics) {
      for (const diagnostic of fileDiagnostics) {
        html += this.renderDiagnosticItem(filepath, diagnostic);
      }
    }

    content.innerHTML = html;

    // Add click handlers
    content.querySelectorAll('.diagnostics-item').forEach(item => {
      item.addEventListener('click', () => {
        const filepath = item.dataset.filepath;
        const line = parseInt(item.dataset.line);
        const character = parseInt(item.dataset.character);
        
        // Open file and jump to location
        this.jumpToLocation(filepath, line, character);
      });
    });
  }

  renderDiagnosticItem(filepath, diagnostic) {
    const severityIcon = this.getSeverityIcon(diagnostic.severity);
    const filename = filepath.split('/').pop();
    
    return `
      <div class="diagnostics-item" data-filepath="${filepath}" data-line="${diagnostic.line}" data-character="${diagnostic.character}">
        <div class="diagnostics-icon ${diagnostic.severity}">
          ${severityIcon}
        </div>
        <div class="diagnostics-details">
          <div class="diagnostics-message">${diagnostic.message}</div>
          <div class="diagnostics-source">${diagnostic.source} • ${filename}</div>
        </div>
        <div class="diagnostics-location">
          ${diagnostic.line}:${diagnostic.character}
        </div>
      </div>
    `;
  }

  getSeverityIcon(severity) {
    switch (severity) {
      case 'error':
        return '●';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ⓘ';
      default:
        return '●';
    }
  }

  jumpToLocation(filepath, line, character) {
    // This would integrate with the editor to open and jump to the location
    if (window.fileExplorer && window.fileExplorer.openFile) {
      window.fileExplorer.openFile(filepath);
      
      // Jump to line after a small delay
      setTimeout(() => {
        if (window.editor && window.editor.setPosition) {
          window.editor.setPosition({ lineNumber: line, column: character });
          window.editor.focus();
        }
      }, 100);
    }
  }

  showInstallInstructions() {
    const content = document.getElementById('diagnostics-content');
    if (!content) return;

    let html = `
      <div class="diagnostics-empty">
        <h3>No Language Servers Found</h3>
        <p>Install language servers to get diagnostics for your code:</p>
        <div class="install-instructions">
    `;

    for (const [ext, serverInfo] of this.languageServers) {
      html += `
        <div class="install-item">
          <h4>${serverInfo.name}</h4>
          <p>${serverInfo.description}</p>
          <div class="install-commands">
      `;

      for (const [manager, command] of Object.entries(serverInfo.installCommand)) {
        if (manager !== 'description') {
          html += `<code>${command}</code><br>`;
        }
      }

      html += `
          </div>
        </div>
      `;
    }

    html += `
        </div>
        <p class="retry-message">
          After installing the language servers above, diagnostics will refresh automatically when you switch files.
        </p>
      </div>
    `;

    content.innerHTML = html;
  }

  updateStatus(status) {
    const statusElement = document.getElementById('diagnostics-status');
    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  getTotalDiagnosticsCount() {
    let count = 0;
    for (const diagnostics of this.diagnostics.values()) {
      count += diagnostics.length;
    }
    return count;
  }

  // Add diagnostic for a file (called by LSP integration)
  addDiagnostic(filepath, diagnostic) {
    if (!this.diagnostics.has(filepath)) {
      this.diagnostics.set(filepath, []);
    }
    this.diagnostics.get(filepath).push(diagnostic);
    this.renderDiagnostics();
  }

  // Clear diagnostics for a file
  clearDiagnostics(filepath) {
    this.diagnostics.delete(filepath);
    this.renderDiagnostics();
  }

  // Clear all diagnostics
  clearAllDiagnostics() {
    this.diagnostics.clear();
    this.renderDiagnostics();
  }

  // Toggle debug mode
  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    this.log('Debug mode toggled:', this.debugMode ? 'ON' : 'OFF');
    
    // Update UI to show debug status
    const debugBtn = document.getElementById('diagnostics-debug-btn');
    if (debugBtn) {
      debugBtn.style.backgroundColor = this.debugMode ? '#4CAF50' : '';
      debugBtn.title = this.debugMode ? 'Debug mode ON - click to disable' : 'Debug mode OFF - click to enable';
    }
    
    // If debug is enabled, show current state
    if (this.debugMode) {
      this.log('Current diagnostics state:', {
        currentFile: window.currentFilePath,
        diagnosticsCount: this.diagnostics.size,
        activeLanguageServers: Array.from(this.activeLanguageServers.keys()),
        isRefreshing: this.isRefreshing
      });
    }
  }

  // Test with sample diagnostics
  testWithSampleDiagnostics() {
    this.log('Testing with sample diagnostics');
    
    let currentFile = window.currentFilePath;
    if (!currentFile) {
      this.log('No current file open, using generic test filename for demo');
      currentFile = 'test-file.js'; // Generic filename for demo purposes
    }
    
    const sampleDiagnostics = [
      {
        severity: 'error',
        message: 'Test error: Undefined variable "example"',
        line: 5,
        character: 10,
        source: 'test-diagnostics'
      },
      {
        severity: 'warning', 
        message: 'Test warning: Unused variable "testVar"',
        line: 12,
        character: 5,
        source: 'test-diagnostics'
      },
      {
        severity: 'info',
        message: 'Test info: Consider using const instead of let',
        line: 8,
        character: 1,
        source: 'test-diagnostics'
      }
    ];
    
    this.diagnostics.clear();
    this.diagnostics.set(currentFile, sampleDiagnostics);
    this.updateStatus(`Ready (${sampleDiagnostics.length} test issues)`);
    this.renderDiagnostics();
    
    this.log('Sample diagnostics applied:', sampleDiagnostics);
  }
  
  // Get debug information
  getDebugInfo() {
    return {
      debugMode: this.debugMode,
      currentFile: window.currentFilePath,
      diagnosticsCount: this.diagnostics.size,
      totalIssues: this.getTotalDiagnosticsCount(),
      activeLanguageServers: Array.from(this.activeLanguageServers.keys()),
      isRefreshing: this.isRefreshing,
      languageServerConfigs: Array.from(this.languageServers.keys()),
      autoRefreshTimeout: this.autoRefreshTimeout !== null
    };
  }
  
  // Helper function for console debugging
  printDebugInfo() {
    console.table(this.getDebugInfo());
    console.log('Current diagnostics:', Array.from(this.diagnostics.entries()));
  }
}

export default DiagnosticsManager;