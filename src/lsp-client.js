import { startLanguageServer, sendLspRequest, sendLspNotification } from './tauri-helpers.js';

/**
 * A proper LSP client implementation using vscode-languageclient patterns
 * but adapted for our Tauri-based architecture
 */
export class LSPClient {
  constructor(serverInfo, language) {
    this.serverInfo = serverInfo;
    this.language = language;
    this.processId = null;
    this.initialized = false;
    this.capabilities = null;
    this.openDocuments = new Set();
    this.requestId = 1;
    this.responseHandlers = new Map();
    this.notificationHandlers = new Map();
    
    // Set up default notification handlers
    this.onNotification('textDocument/publishDiagnostics', this.handlePublishDiagnostics.bind(this));
    this.onNotification('window/logMessage', this.handleLogMessage.bind(this));
  }

  async start(rootUri) {
    if (this.processId) {
      console.log(`[LSPClient] ${this.serverInfo.name} already started`);
      return true;
    }

    try {
      console.log(`[LSPClient] Starting ${this.serverInfo.name}...`);
      this.processId = await startLanguageServer(
        this.serverInfo.command,
        this.serverInfo.args,
        this.language
      );

      if (!this.processId) {
        throw new Error('Failed to start language server process');
      }

      console.log(`[LSPClient] ${this.serverInfo.name} started with process ID: ${this.processId}`);
      
      // Initialize the server
      await this.initialize(rootUri);
      await this.initialized();
      
      this.initialized = true;
      console.log(`[LSPClient] ${this.serverInfo.name} initialized successfully`);
      return true;

    } catch (error) {
      console.error(`[LSPClient] Failed to start ${this.serverInfo.name}:`, error);
      this.processId = null;
      return false;
    }
  }

  async initialize(rootUri) {
    const params = {
      processId: null,
      rootUri: rootUri,
      capabilities: {
        textDocument: {
          publishDiagnostics: {},
          synchronization: {
            didSave: true,
            willSave: true,
            willSaveWaitUntil: true,
            dynamicRegistration: false
          },
          completion: {
            completionItem: {
              snippetSupport: true
            }
          }
        },
        workspace: {
          workspaceFolders: true,
          configuration: true
        }
      },
      initializationOptions: null,
      trace: 'off'
    };

    const response = await this.sendRequest('initialize', params);
    if (response && response.capabilities) {
      this.capabilities = response.capabilities;
      console.log(`[LSPClient] ${this.serverInfo.name} capabilities:`, this.capabilities);
    }
    return response;
  }

  async initialized() {
    await this.sendNotification('initialized', {});
  }

  async sendRequest(method, params) {
    if (!this.processId) {
      throw new Error('Language server not started');
    }

    const id = this.requestId++;
    const request = {
      jsonrpc: '2.0',
      id: id,
      method: method,
      params: params
    };

    console.log(`[LSPClient] Sending request ${method} (id: ${id})`);
    
    return new Promise(async (resolve, reject) => {
      // Set up response handler
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(id);
        reject(new Error(`Request ${method} (id: ${id}) timed out`));
      }, 10000); // 10 second timeout

      this.responseHandlers.set(id, (response) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(`LSP Error: ${response.error.message}`));
        } else {
          resolve(response.result);
        }
      });

      try {
        await sendLspRequest(this.processId, JSON.stringify(request));
      } catch (error) {
        clearTimeout(timeout);
        this.responseHandlers.delete(id);
        reject(error);
      }
    });
  }

  async sendNotification(method, params) {
    if (!this.processId) {
      throw new Error('Language server not started');
    }

    const notification = {
      jsonrpc: '2.0',
      method: method,
      params: params
    };

    console.log(`[LSPClient] Sending notification ${method}`);
    await sendLspNotification(this.processId, JSON.stringify(notification));
  }

  async didOpen(uri, languageId, version, text) {
    await this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: uri,
        languageId: languageId,
        version: version,
        text: text
      }
    });
    this.openDocuments.add(uri);
  }

  async didChange(uri, version, changes) {
    await this.sendNotification('textDocument/didChange', {
      textDocument: {
        uri: uri,
        version: version
      },
      contentChanges: changes
    });
  }

  async didClose(uri) {
    await this.sendNotification('textDocument/didClose', {
      textDocument: {
        uri: uri
      }
    });
    this.openDocuments.delete(uri);
  }

  async documentSymbol(uri) {
    return await this.sendRequest('textDocument/documentSymbol', {
      textDocument: {
        uri: uri
      }
    });
  }

  async completion(uri, position) {
    return await this.sendRequest('textDocument/completion', {
      textDocument: {
        uri: uri
      },
      position: position
    });
  }

  // Event handlers
  onNotification(method, handler) {
    this.notificationHandlers.set(method, handler);
  }

  handleMessage(message) {
    try {
      const data = JSON.parse(message);
      console.log(`[LSPClient] ${this.serverInfo.name} received:`, data);
      
      if (data.id && (data.result !== undefined || data.error)) {
        // This is a response to a request
        console.log(`[LSPClient] ${this.serverInfo.name} handling response for ID:`, data.id);
        const handler = this.responseHandlers.get(data.id);
        if (handler) {
          this.responseHandlers.delete(data.id);
          console.log(`[LSPClient] ${this.serverInfo.name} found handler for ID:`, data.id);
          handler(data);
        } else {
          console.log(`[LSPClient] ${this.serverInfo.name} no handler found for ID:`, data.id);
        }
      } else if (data.method) {
        // This is a notification
        const handler = this.notificationHandlers.get(data.method);
        if (handler) {
          handler(data.params);
        }
      }
    } catch (error) {
      console.error(`[LSPClient] Failed to handle message:`, error, 'Message:', message);
    }
  }

  handlePublishDiagnostics(params) {
    // Override this in the diagnostics manager
    console.log(`[LSPClient] Diagnostics for ${params.uri}:`, params.diagnostics);
  }

  handleLogMessage(params) {
    const levels = ['ERROR', 'WARN', 'INFO', 'LOG'];
    const level = levels[params.type - 1] || 'LOG';
    console.log(`[LSPClient] ${this.serverInfo.name} ${level}:`, params.message);
  }

  isDocumentOpen(uri) {
    return this.openDocuments.has(uri);
  }

  async shutdown() {
    if (this.processId) {
      try {
        await this.sendRequest('shutdown', null);
        await this.sendNotification('exit', null);
      } catch (error) {
        console.error(`[LSPClient] Error during shutdown:`, error);
      }
      this.processId = null;
      this.initialized = false;
      this.openDocuments.clear();
      this.responseHandlers.clear();
    }
  }
}

export default LSPClient;
