// diagnostics.js - Project diagnostics via LSP servers

  import { readFile } from './file-system.js';
  import { 
    checkCommandExists, 
    listenToLspMessages,
    listenToLspDiagnostics
  } from './tauri-helpers.js';
  import lsDepManager from './language-server-dep-manager.js';
  import SimpleLSPClient from './simple-lsp-client.js';

class DiagnosticsManager {
  constructor(fileExplorer) {
    this.fileExplorer = fileExplorer;
    this.diagnostics = new Map(); // filepath -> diagnostics array
    this.languageServers = new Map(); // file extension -> LSP info
    this.openDocuments = new Set(); // Track which documents are open in LSP
    this.isRefreshing = false;
    this.autoRefreshTimeout = null; // For debouncing auto-refresh
         this.activeLanguageServers = new Map(); // language -> LSPClient instance
    this.debugMode = true; // Enable debug logging
    this.lspResponses = new Map(); // Store responses from LSP

    // Bind methods to ensure correct `this` context
    this.handleLspMessage = this.handleLspMessage.bind(this);
    this.refresh = this.refresh.bind(this);

    this.init();
  }


  async init() {
    await lsDepManager.initialize();
    this.setupEventListeners();
    this.setupLanguageServers();
    this.log('DiagnosticsManager initialized');
    
    // Listen for structured LSP messages and raw log lines
    listenToLspMessages((event) => {
      if (event.event === 'lsp_message') {
        this.handleLspMessage(event.payload);
      } else if (event.event === 'lsp_log_line') {
        this.lspLogHandler(event.payload);
      }
    });

    // Listen for diagnostics events directly from backend
    listenToLspDiagnostics((params) => {
      try {
        // Route to active clients for any custom handling
        for (const [, client] of this.activeLanguageServers) {
          if (client && client.diagnosticsHandler) {
            client.diagnosticsHandler(params);
          }
        }
        // Also map to our flattened diagnostics for the current file if applicable
        const uri = params.uri || '';
        const filepath = uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
        const lspDiagnostics = Array.isArray(params.diagnostics) ? params.diagnostics : [];
        const converted = this.convertLspDiagnostics(lspDiagnostics);
        if (filepath) {
          this.diagnostics.set(filepath, converted);
          this.renderDiagnostics();
        }
      } catch (e) {
        this.error('Failed to process lsp_diagnostics:', e);
      }
    });
    
    // Expose to global scope for debugging
    window.diagnosticsManager = this;
  }
  
     lspLogHandler(line) {
     if (typeof line === 'string' && line.trim()) {
       console.log('[Diagnostics LSP]', line.trim());
       
       // Check for rust-analyzer specific errors
       if (line.includes('malformed header') || line.includes('Error:')) {
         this.error('LSP Server Error:', line.trim());
       }
     }
   }

  handleLspMessage(message) {
    try {
      this.log('Raw LSP message:', message);
      if (typeof message === 'string') {
        // Find the start of the JSON content
        const jsonStart = message.indexOf('{"jsonrpc"');
        if (jsonStart === -1) {
          this.log('LSP message does not seem to be a JSON-RPC object, ignoring:', message);
          return;
        }
        
        const jsonString = message.substring(jsonStart);
        
        // Route message to all active LSP clients
        for (const [language, client] of this.activeLanguageServers) {
          if (client && client.handleMessage) {
            client.handleMessage(jsonString);
          }
        }
      }
    } catch (error) {
      this.error('Failed to handle LSP message:', error, 'Original message:', message);
    }
  }

  
  log(message, ...args) {
    if (this.debugMode) {
      console.log('[DiagnosticsManager]', message, ...args);
    }
  }
  
  error(message, ...args) {
    console.error('[DiagnosticsManager ERROR]', message, ...args);
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
    this.languageServers.set('js', {
      name: 'ESLint',
      command: 'eslint',
      args: ['-f', 'json'],
      type: 'global',
      extensions: ['.js', '.jsx'],
      installCommand: 'npm install -g eslint',
      description: 'ESLint CLI diagnostics for JavaScript/TypeScript'
    });

    this.languageServers.set('ts', {
        name: 'ESLint',
        command: 'eslint',
        args: ['-f', 'json'],
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
       name: 'rust-analyzer',
       command: 'rust-analyzer', 
       args: [], // communicates via stdio by default
       type: 'global',
       extensions: ['.rs'],
       installCommand: 'rustup component add rust-analyzer',
       description: 'Rust language server (requires Cargo.toml in workspace)'
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
        this.log('Language server not available, attempting auto-install');
        if (serverInfo.type === 'npm') {
          try {
            const installed = await lsDepManager.ensureServerInstalled(serverInfo.command, serverInfo.npmPackage);
            if (installed) {
              serverInfo.command = lsDepManager.getServerExecutablePath(serverInfo.command);
              this.log('Auto-install successful, proceeding');
            } else {
              this.log('Auto-install failed, showing install instructions');
              this.showInstallInstructionsForFile(serverInfo, ext, true);
              return;
            }
          } catch (e) {
            this.log('Auto-install exception, showing install instructions', e);
            this.showInstallInstructionsForFile(serverInfo, ext, true);
            return;
          }
        } else {
          this.showInstallInstructionsForFile(serverInfo, ext, false);
          return;
        }
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
    if (serverInfo.type === 'npm') {
        const installed = await lsDepManager.ensureServerInstalled(serverInfo.command, serverInfo.npmPackage);
        if (installed) {
            // Overwrite the command with the full path to the local executable
            serverInfo.command = lsDepManager.getServerExecutablePath(serverInfo.command);
            this.log(`Using locally installed server at: ${serverInfo.command}`);
        }
        return installed;
    }

    // For global servers, check if the command exists in the PATH
    const cacheKey = `lsp_${serverInfo.command}`;
    if (!forceRefresh) {
      const cached = this.getCachedServerStatus(cacheKey);
      if (cached !== null) return cached;
    }

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
      // JS/TS via ESLint CLI (no LSP)
      if (serverInfo.name === 'ESLint' && serverInfo.command === 'eslint') {
        const content = await this.readFileContent(filePath);
        if (!content) return [];
                 try {
           const cwd = filePath.substring(0, filePath.lastIndexOf('/')) || process.cwd();
           // Use ESLint with basic rules and suppress warnings
           const output = await window.tauri.core.invoke('run_command', { 
             command: 'env', 
             args: [
               'ESLINT_USE_FLAT_CONFIG=false', 
               'eslint', 
               '--no-eslintrc', 
               '--env', 'es6', 
               '--env', 'browser', 
               '--env', 'node',
               '--rule', 'no-unused-vars:error',
               '--rule', 'no-undef:error', 
               '--rule', 'no-console:warn',
               '--quiet', // Suppress warnings, only show errors
               '-f', 'json', 
               filePath
             ], 
             cwd 
           });
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
       const client = await this.ensureLanguageServerRunning(serverInfo, language);
       if (!client) return [];
       const fileContent = await this.readFileContent(filePath);
       if (!fileContent) return [];
       const diagnostics = await this.requestDiagnostics(client, filePath, language, fileContent);
       this.log('LSP diagnostics received:', diagnostics);
       return diagnostics;
      
    } catch (error) {
      this.error('Failed to get LSP diagnostics:', error);
      return [];
    }
  }
  

  
     async ensureLanguageServerRunning(serverInfo, language) {
     const existing = this.activeLanguageServers.get(language);
     if (existing && existing.initialized) {
       this.log('Language server already running and initialized for:', language);
       return existing;
     }

     try {
       // Determine the root URI for the language server.
       let rootUri = null;
       if (this.fileExplorer && this.fileExplorer.rootFolder) {
         rootUri = `file://${this.fileExplorer.rootFolder}`;
         this.log('Using workspace root for LSP:', rootUri);
       } else if (window.currentFilePath) {
         const currentFileDir = window.currentFilePath.substring(0, window.currentFilePath.lastIndexOf('/'));
         rootUri = `file://${currentFileDir}`;
         this.log('No workspace open, using current file directory as root for LSP:', rootUri);
       }

       if (!rootUri) {
         this.log('Cannot start language server: No workspace or file is open to determine a root directory.');
         return null;
       }

       // Special handling for rust-analyzer - needs Cargo.toml in workspace
       if (serverInfo.command === 'rust-analyzer') {
         const cargoPath = rootUri.replace('file://', '') + '/Cargo.toml';
         try {
           const cargoExists = await window.tauri.core.invoke('file_exists', { file_path: cargoPath });
           if (!cargoExists) {
             this.log('rust-analyzer requires Cargo.toml in workspace. Checked:', cargoPath);
             this.error('rust-analyzer requires a Cargo project (Cargo.toml not found in workspace)');
             return null;
           }
         } catch (e) {
           this.log('Could not check for Cargo.toml:', e);
         }
       }

       // Create and start simple LSP client
       const client = new SimpleLSPClient(serverInfo, language);
       
       const started = await client.start(rootUri);
       if (started) {
         this.activeLanguageServers.set(language, client);
         this.log(`LSP client for ${language} started and initialized successfully`);
         return client;
       } else {
         this.error(`Failed to start LSP client for ${language}`);
         return null;
       }

     } catch (error) {
       this.error('Failed to start or initialize language server:', error);
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
  
  
  
     async requestDiagnostics(client, filePath, language, content) {
     this.log('Requesting diagnostics via LSP for:', filePath);

     try {
       // Use the simple client's direct diagnostics method
       const rawDiagnostics = await client.getDiagnostics(filePath, language, content);
       const diagnostics = this.convertLspDiagnostics(rawDiagnostics);
       
       this.log(`Received ${diagnostics.length} diagnostics for ${filePath}`);
       return diagnostics;
       
     } catch (error) {
       this.error('Failed to get diagnostics from LSP:', error);
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

  showInstallInstructionsForFile(serverInfo, ext, canAutoInstall = false) {
    this.updateStatus(`${serverInfo.name} not installed`);
    const content = document.getElementById('diagnostics-content');
    if (!content) return;

    content.innerHTML = `
      <div class="install-instructions">
        <h3>Language Server Not Found</h3>
        <p>To get diagnostics for .${ext} files, install <strong>${serverInfo.name}</strong>:</p>
        <div class="install-commands">
          <div class="install-option"><code>${serverInfo.installCommand || ''}</code></div>
        </div>
        ${canAutoInstall ? '<button id="auto-install-ls" class="retry-button">Install automatically</button>' : ''}
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

    const autoBtn = document.getElementById('auto-install-ls');
    if (autoBtn) {
      autoBtn.addEventListener('click', async () => {
        this.updateStatus('Installing language server...');
        try {
          const ok = await lsDepManager.ensureServerInstalled(serverInfo.command, serverInfo.npmPackage);
          if (ok) {
            serverInfo.command = lsDepManager.getServerExecutablePath(serverInfo.command);
            this.updateStatus('Installed. Rechecking...');
            await this.forceRefresh();
          } else {
            this.updateStatus('Install failed');
          }
        } catch (e) {
          this.updateStatus('Install failed');
        }
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