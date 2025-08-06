# Language Servers Panel Test

## How to Test the Language Servers Panel

1. **Open the Language Servers Panel**:
   - Click the "LSP" button in the sidebar, OR
   - Press `Ctrl/Cmd + Shift + L`, OR  
   - Use Command Palette → "Language Servers Panel"

2. **Add a Language Server**:
   - Click the `+` button
   - Fill in the form:
     - **Name**: TypeScript Server
     - **Language**: typescript
     - **Host**: localhost
     - **Port**: 2087
     - **Command**: `npx typescript-language-server --stdio`
   - Click "Add Server"

3. **Test Connection**:
   - You'll see the server card with ⚪ Disconnected status
   - Click the ▶️ Connect button
   - Status should change to 🟡 Connecting, then either:
     - 🟢 Connected (if server is running)
     - 🔴 Error (if server is not running)

## Starting Language Servers

To actually test connections, you need to start language servers on specific ports.

### TypeScript Language Server
```bash
npx typescript-language-server --stdio --socket=2087
```

### Python Language Server  
```bash
pip install python-lsp-server
pylsp --tcp --host localhost --port 2088
```

### Mock Language Server (for testing)
```javascript
// Simple WebSocket server that responds to LSP requests
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const request = JSON.parse(message);
    console.log('LSP Request:', request);
    
    // Mock response
    const response = {
      jsonrpc: '2.0',
      id: request.id,
      result: request.method === 'textDocument/documentSymbol' 
        ? [{ name: 'TestSymbol', kind: 12, range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } } }]
        : null
    };
    
    ws.send(JSON.stringify(response));
  });
});
```

## Expected Behavior

- ✅ UI loads without errors
- ✅ Can add/remove servers (stored in localStorage)
- ✅ Visual status updates work
- ✅ WebSocket connections attempt to connect
- ✅ Error handling for failed connections
- ✅ Outline panel can request symbols from connected servers

## Features Working

1. **Todo-style Management**: Add, remove, connect, disconnect servers
2. **Persistent Storage**: Servers saved/loaded from localStorage
3. **Real WebSocket Connections**: Direct TCP connections to language servers
4. **LSP Protocol**: JSON-RPC 2.0 message handling
5. **Visual Feedback**: Status indicators and error states
6. **Integration**: Outline panel uses connected servers for document symbols