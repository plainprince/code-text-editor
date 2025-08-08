/**
 * Simple LSP Client focused on diagnostics
 * Inspired by the clean architecture from https://github.com/codersauce/red/blob/master/src/lsp/client.rs
 */

import { startLanguageServer, sendLspRequest, sendLspNotification } from './tauri-helpers.js';

export class SimpleLSPClient {
  constructor(serverInfo, language) {
    this.serverInfo = serverInfo;
    this.language = language;
    this.processId = null;
    this.initialized = false;
    this.requestId = 1;
    this.pendingRequests = new Map();
    this.diagnosticsHandler = null;
    this.openDocuments = new Set();
    
    console.log(`[SimpleLSP] Created client for ${serverInfo.name}`);
  }

  async start(rootUri) {
    if (this.processId) return true;

    try {
      console.log(`[SimpleLSP] Starting ${this.serverInfo.name}...`);
      this.processId = await startLanguageServer(
        this.serverInfo.command,
        this.serverInfo.args,
        this.language
      );

      if (!this.processId) {
        throw new Error('Failed to start language server process');
      }

      // Simple initialize request
      const initResult = await this.sendRequest('initialize', {
        processId: null,
        rootUri: rootUri,
        capabilities: {
          textDocument: {
            publishDiagnostics: {},
            synchronization: { didOpen: true, didChange: true, didClose: true }
          }
        }
      });

      console.log(`[SimpleLSP] ${this.serverInfo.name} capabilities:`, initResult.capabilities);

      // Send initialized notification
      await this.sendNotification('initialized', {});
      
      this.initialized = true;
      console.log(`[SimpleLSP] ${this.serverInfo.name} ready`);
      return true;

    } catch (error) {
      console.error(`[SimpleLSP] Failed to start ${this.serverInfo.name}:`, error);
      return false;
    }
  }

  async sendRequest(method, params) {
    const id = this.requestId++;
    const request = {
      jsonrpc: '2.0',
      id: id,
      method: method,
      params: params
    };

    console.log(`[SimpleLSP] → ${method} (${id})`);

    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`${method} request timed out`));
      }, 15000);

      this.pendingRequests.set(id, { resolve, reject, timeout, method });

      try {
        await sendLspRequest(this.processId, JSON.stringify(request));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  async sendNotification(method, params) {
    const notification = {
      jsonrpc: '2.0',
      method: method,
      params: params
    };

    console.log(`[SimpleLSP] → ${method} (notification)`);
    await sendLspNotification(this.processId, JSON.stringify(notification));
  }

  // Handle incoming LSP messages
  handleMessage(jsonMessage) {
    try {
      const msg = JSON.parse(jsonMessage);
      
      if (msg.id && (msg.result !== undefined || msg.error)) {
        // Response to a request
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(msg.id);
          
          if (msg.error) {
            console.error(`[SimpleLSP] ← ${pending.method} error:`, msg.error);
            pending.reject(new Error(msg.error.message));
          } else {
            console.log(`[SimpleLSP] ← ${pending.method} success`);
            pending.resolve(msg.result);
          }
        }
      } else if (msg.method === 'textDocument/publishDiagnostics') {
        // Diagnostics notification
        console.log(`[SimpleLSP] ← diagnostics for ${msg.params.uri}`);
        if (this.diagnosticsHandler) {
          this.diagnosticsHandler(msg.params);
        }
      } else if (msg.method === 'window/logMessage') {
        console.log(`[SimpleLSP] Server log:`, msg.params.message);
      }
    } catch (error) {
      console.error(`[SimpleLSP] Failed to parse message:`, error);
    }
  }

  async openDocument(uri, languageId, text) {
    await this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: uri,
        languageId: languageId,
        version: 1,
        text: text
      }
    });
    this.openDocuments.add(uri);
  }

  async changeDocument(uri, text) {
    await this.sendNotification('textDocument/didChange', {
      textDocument: {
        uri: uri,
        version: Date.now()
      },
      contentChanges: [{ text: text }]
    });
  }

  async closeDocument(uri) {
    await this.sendNotification('textDocument/didClose', {
      textDocument: { uri: uri }
    });
    this.openDocuments.delete(uri);
  }

  // Simple diagnostics getter - just open a document and wait for results
  async getDiagnostics(filePath, languageId, content) {
    if (!this.initialized) {
      throw new Error('LSP client not initialized');
    }

    const uri = `file://${filePath}`;
    
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve([]); // Return empty if no diagnostics received
      }, 5000);

      // Set up one-time diagnostics handler
      this.diagnosticsHandler = (params) => {
        if (params.uri === uri) {
          clearTimeout(timeout);
          this.diagnosticsHandler = null;
          resolve(params.diagnostics || []);
        }
      };

      try {
        if (this.openDocuments.has(uri)) {
          await this.changeDocument(uri, content);
        } else {
          await this.openDocument(uri, languageId, content);
        }
      } catch (error) {
        clearTimeout(timeout);
        this.diagnosticsHandler = null;
        reject(error);
      }
    });
  }

  async shutdown() {
    if (this.processId) {
      try {
        await this.sendNotification('shutdown', null);
        await this.sendNotification('exit', null);
      } catch (error) {
        console.error(`[SimpleLSP] Shutdown error:`, error);
      }
      this.processId = null;
      this.initialized = false;
    }
  }
}

export default SimpleLSPClient;
