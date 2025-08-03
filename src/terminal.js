// terminal.js - Real terminal emulator with PTY support

class Terminal {
  constructor(container) {
    this.container = container;
    this.isActive = false;
    this.sessionId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.workingDirectory = null;
    
    this.init();
  }
  
  async init() {
    this.createTerminalUI();
    await this.createSession();
  }
  
  createTerminalUI() {
    const terminal = document.getElementById("terminal");
    if (!terminal) return;
    
    const content = terminal.querySelector(".terminal-content");
    if (!content) return;
    
    content.innerHTML = `
      <div class="terminal-session" id="terminal-session" tabindex="0">
        <div class="terminal-output" id="terminal-output"></div>
      </div>
    `;
    
    const session = content.querySelector("#terminal-session");
    session.addEventListener('keydown', this.handleInput.bind(this));
    session.addEventListener('keypress', this.handleCharacterInput.bind(this));
    
    // Make terminal focusable and focus it
    session.focus();
    
    // Listen for terminal output from the backend
    this.setupOutputListener();
  }
  
  async createSession() {
    try {
      await window.__TAURI__.core.invoke("create_terminal_session", { 
        sessionId: this.sessionId 
      });
      this.addToOutput("Terminal session started.\n");
    } catch (err) {
      console.error("Failed to create terminal session:", err);
      this.addToOutput(`Failed to start terminal: ${err}\n`, 'error');
    }
  }
  
  setupOutputListener() {
    // Listen for output from the PTY
    window.__TAURI__.event.listen(`terminal-output-${this.sessionId}`, (event) => {
      this.addToOutput(event.payload);
    });
  }
  
  async handleInput(event) {
    // Handle special keys first
    if (event.key === 'Enter') {
      event.preventDefault();
      await this.writeToTerminal('\r');
      return;
    }
    
    // Handle backspace
    if (event.key === 'Backspace') {
      event.preventDefault();
      await this.writeToTerminal('\u007f'); // DEL character for backspace
      return;
    }
    
    // Handle tab
    if (event.key === 'Tab') {
      event.preventDefault();
      await this.writeToTerminal('\t');
      return;
    }
    
    // Handle Ctrl+C
    if (event.ctrlKey && event.key === 'c') {
      event.preventDefault();
      await this.writeToTerminal('\u0003'); // Ctrl+C
      return;
    }
    
    // Handle Ctrl+D
    if (event.ctrlKey && event.key === 'd') {
      event.preventDefault();
      await this.writeToTerminal('\u0004'); // Ctrl+D
      return;
    }
    
    // Handle arrow keys
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      await this.writeToTerminal('\u001b[A');
      return;
    }
    
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      await this.writeToTerminal('\u001b[B');
      return;
    }
    
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      await this.writeToTerminal('\u001b[D');
      return;
    }
    
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      await this.writeToTerminal('\u001b[C');
      return;
    }
    
    // Handle other control characters
    if (event.ctrlKey && event.key.length === 1) {
      event.preventDefault();
      const char = event.key.toLowerCase();
      const ctrlChar = String.fromCharCode(char.charCodeAt(0) - 96);
      await this.writeToTerminal(ctrlChar);
      return;
    }
  }
  
  // Handle regular character input
  async handleCharacterInput(event) {
    // Only handle printable characters
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      await this.writeToTerminal(event.key);
    }
  }
  
  async writeToTerminal(data) {
    try {
      await window.__TAURI__.core.invoke("write_to_terminal", {
        sessionId: this.sessionId,
        data: data
      });
    } catch (err) {
      console.error("Failed to write to terminal:", err);
    }
  }
  
  addToOutput(text, type = 'normal') {
    const output = document.getElementById("terminal-output");
    if (!output) return;
    
    // Create a text node to preserve formatting and avoid XSS
    const textNode = document.createTextNode(text);
    
    // Handle different types of output
    if (type === 'error') {
      const errorSpan = document.createElement('span');
      errorSpan.className = 'terminal-error';
      errorSpan.appendChild(textNode);
      output.appendChild(errorSpan);
    } else {
      output.appendChild(textNode);
    }
    
    // Scroll to bottom
    output.scrollTop = output.scrollHeight;
  }
  
  clearOutput() {
    const output = document.getElementById("terminal-output");
    if (output) {
      output.innerHTML = '';
    }
  }
  
  setWorkingDirectory(path) {
    this.workingDirectory = path;
    // Send cd command to change directory in the PTY
    if (path) {
      this.writeToTerminal(`cd "${path}"\n`);
    }
  }
  
  show() {
    const terminal = document.getElementById("terminal");
    if (terminal) {
      terminal.style.display = 'flex';
      this.isActive = true;
      
      // Focus terminal session
      const session = document.getElementById("terminal-session");
      if (session) {
        session.focus();
      }
      
      // Resize terminal to fit
      this.resize();
    }
  }
  
  hide() {
    const terminal = document.getElementById("terminal");
    if (terminal) {
      terminal.style.display = 'none';
      this.isActive = false;
    }
  }
  
  toggle() {
    if (this.isActive) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  async resize() {
    const terminal = document.getElementById("terminal");
    if (!terminal) return;
    
    // Calculate terminal size based on container
    const rect = terminal.getBoundingClientRect();
    const charWidth = 8; // Approximate character width
    const charHeight = 16; // Approximate character height
    
    const cols = Math.floor(rect.width / charWidth);
    const rows = Math.floor(rect.height / charHeight);
    
    try {
      await window.__TAURI__.core.invoke("resize_terminal", {
        sessionId: this.sessionId,
        rows: Math.max(rows, 10),
        cols: Math.max(cols, 40)
      });
    } catch (err) {
      console.error("Failed to resize terminal:", err);
    }
  }
  
  async destroy() {
    try {
      await window.__TAURI__.core.invoke("close_terminal_session", {
        sessionId: this.sessionId
      });
    } catch (err) {
      console.error("Failed to close terminal session:", err);
    }
  }
}

export default Terminal;