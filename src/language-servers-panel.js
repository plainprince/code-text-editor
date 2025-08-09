// Language Servers Panel - Manage TCP connections to language servers
// Works like a todo app but for language server ports

// Language servers panel now works with CodeMirror instead of Monaco

class LanguageServersPanel {
  constructor() {
    this.container = document.querySelector("#language-servers-panel .sidebar-panel-content");
    this.servers = new Map(); // serverName -> config
    this.connections = new Map(); // serverName -> client
    this.isInitialized = false;
    
    // Load saved servers from localStorage
    this.loadServersFromStorage();
    
    // Initialize UI
    this.initializeUI();
  }
  
  // Wait for Tauri APIs to be available (in dev mode they load asynchronously)
  async waitForTauri(maxAttempts = 50, delay = 100) {
    console.log('Waiting for Tauri APIs to be available...');
    for (let i = 0; i < maxAttempts; i++) {
      if (window.__TAURI__ && window.__TAURI__.tauri && window.__TAURI__.tauri.invoke) {
        console.log(`Tauri APIs available after ${i * delay}ms`);
        return window.__TAURI__.tauri.invoke;
      }
      if (i === 0) {
        console.log('Tauri not immediately available, checking every 100ms...');
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    console.warn(`Tauri APIs not available after ${maxAttempts * delay}ms`);
    return null;
  }

  // Initialize the UI
  initializeUI() {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="language-servers-header">
        <h3>Language Servers</h3>
        <button class="add-server-btn" title="Add Language Server">+</button>
      </div>
      <div class="language-servers-list"></div>
      <div class="language-servers-help">
        <p>Add language servers via TCP ports or STDIO processes.</p>
        <p><strong>STDIO Examples (recommended):</strong></p>
        <ul>
          <li>TypeScript: <code>typescript-language-server --stdio</code></li>
          <li>Python: <code>pylsp</code></li>
          <li>Rust: <code>rust-analyzer</code></li>
          <li>Go: <code>gopls</code></li>
          <li>Java: <code>jdtls</code></li>
        </ul>
        <p><strong>TCP Examples:</strong></p>
        <ul>
          <li>Custom servers running on specific ports</li>
          <li>Remote language servers</li>
        </ul>
      </div>
    `;
    
    // Add event listeners
    this.container.querySelector('.add-server-btn').addEventListener('click', () => {
      this.showAddServerDialog();
    });
    
    // Render existing servers
    this.renderServers();
  }
  
  // Show add server dialog
  showAddServerDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'add-server-dialog';
    dialog.innerHTML = `
      <div class="dialog-overlay">
        <div class="dialog-content">
          <h3>Add Language Server</h3>
          <form class="add-server-form">
            <div class="form-group">
              <label for="server-name">Name:</label>
              <input type="text" id="server-name" placeholder="e.g., TypeScript Server" required>
            </div>
            <div class="form-group">
              <label for="server-language">Language:</label>
              <select id="server-language" required>
                <option value="">Select language...</option>
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="rust">Rust</option>
                <option value="go">Go</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="csharp">C#</option>
                <option value="php">PHP</option>
                <option value="ruby">Ruby</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
                <option value="xml">XML</option>
                <option value="bash">Bash</option>
              </select>
            </div>
            <div class="form-group">
              <label for="server-connection-type">Connection Type:</label>
              <select id="server-connection-type" required>
                <option value="tcp">TCP/WebSocket</option>
                <option value="stdio">STDIO (Direct Process)</option>
              </select>
            </div>
            <div class="tcp-fields">
              <div class="form-group">
                <label for="server-host">Host:</label>
                <input type="text" id="server-host" value="localhost">
              </div>
              <div class="form-group">
                <label for="server-port">Port:</label>
                <input type="number" id="server-port" placeholder="e.g., 2087" min="1" max="65535">
              </div>
            </div>
            <div class="stdio-fields" style="display: none;">
              <div class="form-group">
                <label for="server-command">Command:</label>
                <input type="text" id="server-command" placeholder="e.g., typescript-language-server --stdio" required>
              </div>
              <div class="form-group">
                <label for="server-args">Arguments (optional):</label>
                <input type="text" id="server-args" placeholder="e.g., --stdio --log-level=verbose">
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="cancel-btn">Cancel</button>
              <button type="submit" class="add-btn">Add Server</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Event listeners
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
      dialog.remove();
    });
    
    dialog.querySelector('.dialog-overlay').addEventListener('click', (e) => {
      if (e.target === dialog.querySelector('.dialog-overlay')) {
        dialog.remove();
      }
    });
    
    // Handle connection type change
    dialog.querySelector('#server-connection-type').addEventListener('change', (e) => {
      const connectionType = e.target.value;
      const tcpFields = dialog.querySelector('.tcp-fields');
      const stdioFields = dialog.querySelector('.stdio-fields');
      
      if (connectionType === 'tcp') {
        tcpFields.style.display = 'block';
        stdioFields.style.display = 'none';
        // Make TCP fields required
        dialog.querySelector('#server-host').required = true;
        dialog.querySelector('#server-port').required = true;
        dialog.querySelector('#server-command').required = false;
      } else {
        tcpFields.style.display = 'none';
        stdioFields.style.display = 'block';
        // Make STDIO fields required
        dialog.querySelector('#server-host').required = false;
        dialog.querySelector('#server-port').required = false;
        dialog.querySelector('#server-command').required = true;
      }
    });
    
    dialog.querySelector('.add-server-form').addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = dialog.querySelector('#server-name').value;
      const language = dialog.querySelector('#server-language').value;
      const connectionType = dialog.querySelector('#server-connection-type').value;
      
      const config = {
        name,
        language,
        connectionType,
        id: Date.now().toString()
      };
      
      if (connectionType === 'tcp') {
        config.host = dialog.querySelector('#server-host').value;
        config.port = parseInt(dialog.querySelector('#server-port').value);
      } else {
        config.command = dialog.querySelector('#server-command').value;
        config.args = dialog.querySelector('#server-args').value;
      }
      
      this.addServer(config);
      dialog.remove();
    });
    
    // Focus first input
    dialog.querySelector('#server-name').focus();
  }
  
  // Add a server
  addServer(config) {
    this.servers.set(config.id, {
      ...config,
      status: 'disconnected',
      lastConnected: null
    });
    
    this.saveServersToStorage();
    this.renderServers();
  }
  
  // Remove a server
  removeServer(serverId) {
    // Disconnect if connected
    if (this.connections.has(serverId)) {
      this.disconnectServer(serverId);
    }
    
    this.servers.delete(serverId);
    this.saveServersToStorage();
    this.renderServers();
  }
  
  // Connect to a server
  async connectServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) return;
    
    try {
      server.status = 'connecting';
      server.errorMessage = null; // Clear any previous error
      this.renderServers();
      
      if (server.connectionType === 'tcp') {
        await this.connectTCP(serverId, server);
      } else {
        await this.connectSTDIO(serverId, server);
      }
      
    } catch (error) {
      console.error(`Failed to connect to ${server.name}:`, error);
      server.status = 'error';
      this.renderServers();
    }
  }
  
  // Connect via TCP/WebSocket
  async connectTCP(serverId, server) {
    // Create WebSocket connection
    const wsUrl = `ws://${server.host}:${server.port}`;
    const webSocket = new WebSocket(wsUrl);
    
    // Set up WebSocket event handlers
    webSocket.onopen = () => {
      server.status = 'connected';
      server.lastConnected = new Date().toISOString();
      console.log(`Connected to ${server.name} at ${server.host}:${server.port}`);
      this.renderServers();
    };
    
    webSocket.onerror = (error) => {
      console.error(`Failed to connect to ${server.name}:`, error);
      server.status = 'error';
      this.renderServers();
    };
    
    webSocket.onclose = () => {
      server.status = 'disconnected';
      this.connections.delete(serverId);
      this.renderServers();
    };
    
    // Create simple LSP client wrapper
    const client = {
      sendRequest: async (method, params) => {
        return new Promise((resolve, reject) => {
          if (webSocket.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket not open'));
            return;
          }
          
          const id = Date.now();
          const message = {
            jsonrpc: '2.0',
            id,
            method,
            params
          };
          
          // Set up response handler
          const responseHandler = (event) => {
            try {
              const response = JSON.parse(event.data);
              if (response.id === id) {
                webSocket.removeEventListener('message', responseHandler);
                if (response.error) {
                  reject(new Error(response.error.message));
                } else {
                  resolve(response.result);
                }
              }
            } catch (e) {
              console.warn('Failed to parse LSP response:', e);
            }
          };
          
          webSocket.addEventListener('message', responseHandler);
          webSocket.send(JSON.stringify(message));
          
          // Timeout after 5 seconds
          setTimeout(() => {
            webSocket.removeEventListener('message', responseHandler);
            reject(new Error('Request timeout'));
          }, 5000);
        });
      }
    };
    
    // Store connection
    this.connections.set(serverId, { client, webSocket, type: 'tcp' });
  }
  
  // Connect via STDIO (using Tauri's command system)
  async connectSTDIO(serverId, server) {
    try {
      // Wait for Tauri to be available
      const invoke = await this.waitForTauri();
      if (!invoke) {
        throw new Error('Failed to connect to Tauri backend after waiting 5 seconds.');
      }
      
      // Parse command and arguments
      const commandParts = server.command.split(' ');
      const command = commandParts[0];
      const args = server.args ? server.args.split(' ') : commandParts.slice(1);
      
      console.log(`Starting STDIO language server: ${command} ${args.join(' ')}`);
      
      // Start the language server process
      const processId = await invoke('start_language_server', {
        command,
        args,
        language: server.language
      });
      
      // Create STDIO LSP client wrapper
      const client = {
        sendRequest: async (method, params) => {
          const id = Date.now();
          const message = {
            jsonrpc: '2.0',
            id,
            method,
            params
          };
          
          try {
            const response = await invoke('send_lsp_request', {
              processId,
              message: JSON.stringify(message)
            });
            
            const parsedResponse = JSON.parse(response);
            if (parsedResponse.error) {
              throw new Error(parsedResponse.error.message);
            }
            
            return parsedResponse.result;
          } catch (error) {
            throw error;
          }
        }
      };
      
      // Store connection
      this.connections.set(serverId, { client, processId, type: 'stdio' });
      
      server.status = 'connected';
      server.lastConnected = new Date().toISOString();
      console.log(`Connected to STDIO language server: ${server.name}`);
      this.renderServers();
      
    } catch (error) {
      console.error(`Failed to start STDIO language server ${server.name}:`, error);
      server.status = 'error';
      server.errorMessage = error.message;
      this.renderServers();
      
      // If Tauri backend connection failed, show helpful message
      if (error.message?.includes('Failed to connect to Tauri backend')) {
        console.warn('Could not connect to Tauri backend for STDIO connections. The Tauri APIs may still be loading.');
      }
    }
  }
  
  // Disconnect from a server
  async disconnectServer(serverId) {
    const connection = this.connections.get(serverId);
    const server = this.servers.get(serverId);
    
    if (connection) {
      try {
        if (connection.type === 'tcp' && connection.webSocket) {
          connection.webSocket.close();
        } else if (connection.type === 'stdio' && connection.processId) {
          // Stop the STDIO language server process
          const invoke = await this.waitForTauri();
          if (invoke) {
            await invoke('stop_language_server', {
              processId: connection.processId
            });
          }
        }
      } catch (error) {
        console.warn(`Error disconnecting from ${server?.name}:`, error);
      }
      
      this.connections.delete(serverId);
    }
    
    if (server) {
      server.status = 'disconnected';
    }
    
    this.renderServers();
  }
  
  // Render servers list
  renderServers() {
    const listContainer = this.container?.querySelector('.language-servers-list');
    if (!listContainer) return;
    
    if (this.servers.size === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <p>No language servers configured.</p>
          <p>Click the + button to add one.</p>
        </div>
      `;
      return;
    }
    
    listContainer.innerHTML = '';
    
    for (const [serverId, server] of this.servers) {
      const serverElement = this.createServerElement(serverId, server);
      listContainer.appendChild(serverElement);
    }
  }
  
  // Create server element
  createServerElement(serverId, server) {
    const element = document.createElement('div');
    element.className = `server-item status-${server.status}`;
    
    const statusIcon = {
      'connected': '🟢',
      'connecting': '🟡',
      'disconnected': '⚪',
      'error': '🔴'
    }[server.status] || '⚪';
    
    const statusText = {
      'connected': 'Connected',
      'connecting': 'Connecting...',
      'disconnected': 'Disconnected',
      'error': 'Connection Error'
    }[server.status] || 'Unknown';
    
    element.innerHTML = `
      <div class="server-header">
        <div class="server-info">
          <span class="server-status">${statusIcon}</span>
          <span class="server-name">${server.name}</span>
          <span class="server-language">${server.language}</span>
        </div>
        <div class="server-actions">
          ${server.status === 'connected' 
            ? '<button class="disconnect-btn" title="Disconnect">⏹️</button>'
            : '<button class="connect-btn" title="Connect">▶️</button>'
          }
          <button class="remove-btn" title="Remove">🗑️</button>
        </div>
      </div>
      <div class="server-details">
        ${server.connectionType === 'tcp' 
          ? `<div class="server-endpoint">TCP: ${server.host}:${server.port}</div>` 
          : `<div class="server-endpoint">STDIO: ${server.command}${server.args ? ' ' + server.args : ''}</div>`
        }
        <div class="server-status-text">${statusText}</div>
        <div class="server-connection-type">Connection: ${server.connectionType?.toUpperCase() || 'TCP'}</div>
        ${server.errorMessage ? `<div class="server-error" style="color: #ff6b6b; font-size: 12px; margin-top: 4px;">${server.errorMessage}</div>` : ''}
        ${server.lastConnected ? `<div class="server-last-connected">Last connected: ${new Date(server.lastConnected).toLocaleString()}</div>` : ''}
      </div>
    `;
    
    // Add event listeners
    const connectBtn = element.querySelector('.connect-btn');
    const disconnectBtn = element.querySelector('.disconnect-btn');
    const removeBtn = element.querySelector('.remove-btn');
    
    if (connectBtn) {
      connectBtn.addEventListener('click', () => this.connectServer(serverId));
    }
    
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => this.disconnectServer(serverId));
    }
    
    removeBtn.addEventListener('click', () => {
      if (confirm(`Remove ${server.name}?`)) {
        this.removeServer(serverId);
      }
    });
    
    return element;
  }
  
  // Get language client for a language
  getLanguageClient(languageId) {
    for (const [serverId, connection] of this.connections) {
      const server = this.servers.get(serverId);
      if (server && server.language === languageId) {
        return connection.client;
      }
    }
    return null;
  }
  
  // Save servers to localStorage
  saveServersToStorage() {
    const serverData = Array.from(this.servers.entries()).map(([id, server]) => [id, {
      ...server,
      status: 'disconnected' // Don't save connection status
    }]);
    localStorage.setItem('languageServers', JSON.stringify(serverData));
  }
  
  // Load servers from localStorage
  loadServersFromStorage() {
    try {
      const stored = localStorage.getItem('languageServers');
      if (stored) {
        const serverData = JSON.parse(stored);
        this.servers = new Map(serverData);
      }
    } catch (error) {
      console.warn('Failed to load language servers from storage:', error);
    }
  }
}

export default LanguageServersPanel;