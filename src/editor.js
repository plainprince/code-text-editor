// editor.js - Handles code editor functionality

class Editor {
  constructor(container) {
    this.container = container;
    this.currentFile = null;
    this.content = '';
    this.textarea = null;
    
    // Initialize editor
    this.init();
  }
  
  // Initialize the editor
  init() {
    // Create textarea
    this.textarea = document.createElement('textarea');
    this.textarea.id = 'editor-content';
    this.textarea.spellcheck = false;
    this.textarea.wrap = 'off';
    
    // Add event listeners
    this.textarea.addEventListener('input', this.handleInput.bind(this));
    this.textarea.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Add to container
    this.container.innerHTML = '';
    this.container.appendChild(this.textarea);
    
    // Set initial content
    this.setContent('');
  }
  
  // Set the content of the editor
  setContent(content) {
    this.content = content;
    this.textarea.value = content;
  }
  
  // Get the content of the editor
  getContent() {
    return this.textarea.value;
  }
  
  // Set the current file
  setCurrentFile(file) {
    this.currentFile = file;
    this.setContent(file.content);
    
    // Set focus
    this.textarea.focus();
  }
  
  // Handle input event
  handleInput(e) {
    // Update content
    this.content = this.textarea.value;
    
    // Update current file if available
    if (this.currentFile) {
      this.currentFile.content = this.content;
    }
  }
  
  // Handle keydown event
  handleKeyDown(e) {
    // Handle tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      
      // Insert tab at cursor position
      const start = this.textarea.selectionStart;
      const end = this.textarea.selectionEnd;
      
      // Get cursor position
      const cursorPosition = this.textarea.selectionStart;
      
      // If text is selected
      if (start !== end) {
        const selectedText = this.textarea.value.substring(start, end);
        const lines = selectedText.split('\n');
        
        // Add tab to beginning of each line
        const newText = lines.map(line => '  ' + line).join('\n');
        
        // Replace selected text
        this.textarea.value = this.textarea.value.substring(0, start) + newText + this.textarea.value.substring(end);
        
        // Set selection
        this.textarea.selectionStart = start;
        this.textarea.selectionEnd = start + newText.length;
      } else {
        // Insert tab at cursor position
        this.textarea.value = this.textarea.value.substring(0, start) + '  ' + this.textarea.value.substring(end);
        
        // Move cursor after tab
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
      }
      
      // Update content
      this.content = this.textarea.value;
      
      // Update current file if available
      if (this.currentFile) {
        this.currentFile.content = this.content;
      }
    }
    
    // Handle auto-indentation on Enter
    if (e.key === 'Enter') {
      const start = this.textarea.selectionStart;
      const currentLine = this.getCurrentLine();
      const indentation = this.getIndentation(currentLine);
      
      // If the current line ends with an opening brace, add extra indentation
      if (currentLine.trim().endsWith('{')) {
        setTimeout(() => {
          const cursorPosition = this.textarea.selectionStart;
          this.textarea.value = 
            this.textarea.value.substring(0, cursorPosition) + 
            indentation + '  ' + 
            this.textarea.value.substring(cursorPosition);
          
          // Move cursor after indentation
          this.textarea.selectionStart = this.textarea.selectionEnd = cursorPosition + indentation.length + 2;
          
          // Update content
          this.content = this.textarea.value;
          
          // Update current file if available
          if (this.currentFile) {
            this.currentFile.content = this.content;
          }
        }, 0);
      } else {
        // Add same indentation as current line
        setTimeout(() => {
          const cursorPosition = this.textarea.selectionStart;
          this.textarea.value = 
            this.textarea.value.substring(0, cursorPosition) + 
            indentation + 
            this.textarea.value.substring(cursorPosition);
          
          // Move cursor after indentation
          this.textarea.selectionStart = this.textarea.selectionEnd = cursorPosition + indentation.length;
          
          // Update content
          this.content = this.textarea.value;
          
          // Update current file if available
          if (this.currentFile) {
            this.currentFile.content = this.content;
          }
        }, 0);
      }
    }
  }
  
  // Get the current line
  getCurrentLine() {
    const text = this.textarea.value;
    const cursorPosition = this.textarea.selectionStart;
    const lineStart = text.lastIndexOf('\n', cursorPosition - 1) + 1;
    const lineEnd = text.indexOf('\n', cursorPosition);
    
    if (lineEnd === -1) {
      return text.substring(lineStart);
    }
    
    return text.substring(lineStart, lineEnd);
  }
  
  // Get the indentation of a line
  getIndentation(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
  }
}

export default Editor;