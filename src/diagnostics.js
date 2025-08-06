// diagnostics.js - Project diagnostics via LSP servers

class DiagnosticsManager {
  constructor() {
    this.diagnostics = new Map(); // filepath -> diagnostics array
    this.languageServers = new Map(); // file extension -> LSP info
    this.isRefreshing = false;
    this.autoRefreshTimeout = null; // For debouncing auto-refresh
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupLanguageServers();
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
    if (this.isRefreshing) return;

    // Get current file if not specified
    if (!filePath) {
      filePath = window.currentFilePath || null;
    }

    if (!filePath) {
      this.updateStatus('No file open');
      this.renderEmptyDiagnostics();
      return;
    }

    this.isRefreshing = true;
    this.updateStatus('Checking language server...');

    try {
      // Get file extension
      const ext = this.getFileExtension(filePath);
      if (!ext) {
        this.updateStatus('Unsupported file type');
        this.renderEmptyDiagnostics();
        return;
      }

      // Check if language server is available for this file type
      const serverInfo = this.getLanguageServerForExtension(ext);
      if (!serverInfo) {
        this.updateStatus('No language server configured');
        this.renderEmptyDiagnostics();
        return;
      }

      // Check server availability (with optional force refresh)
      const isAvailable = await this.checkServerAvailability(serverInfo, forceRefresh);
      
      if (!isAvailable) {
        this.showInstallInstructionsForFile(serverInfo, ext);
        return;
      }

      this.updateStatus('Collecting diagnostics...');
      
      // Get diagnostics for current file only
      await this.collectFileDiagnostics(filePath, serverInfo);
      
      const count = this.getFileDiagnosticsCount(filePath);
      if (count === 0) {
        this.updateStatus('Ready (no issues found)');
      } else {
        this.updateStatus(`Ready (${count} issues)`);
      }
    } catch (error) {
      console.error('Failed to refresh diagnostics:', error);
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
      const result = await window.__TAURI__.core.invoke('check_command_exists', { command: serverInfo.command });
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
      const result = await window.__TAURI__.core.invoke('check_command_exists', { command });
      return result;
    } catch (error) {
      return false;
    }
  }

  async collectFileDiagnostics(filePath, serverInfo) {
    // Clear all diagnostics to avoid accumulation when switching files
    this.diagnostics.clear();
    
    // TODO: Integrate with actual LSP servers via the Rust backend
    // For now, we'll check if there's a real language server available
    // and either get real diagnostics or show no diagnostics
    
    try {
      // Check if we have a language server manager available for real LSP integration
      if (window.languageServerManager) {
        // Try to get real diagnostics from the language server manager
        const realDiagnostics = await this.getRealDiagnostics(filePath, serverInfo);
        this.diagnostics.set(filePath, realDiagnostics);
      } else {
        // No real LSP integration available yet - just show empty diagnostics
        this.diagnostics.set(filePath, []);
      }
    } catch (error) {
      console.log('LSP integration not ready, showing no diagnostics:', error.message);
      this.diagnostics.set(filePath, []);
    }

    this.renderDiagnostics();
  }
  
  async getRealDiagnostics(filePath, serverInfo) {
    // Placeholder for real LSP integration
    // This would send textDocument/publishDiagnostics request to the language server
    
    // For now, return empty array until full LSP integration is implemented
    return [];
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
}

export default DiagnosticsManager;