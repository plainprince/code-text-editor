// editor.js - Handles code editor functionality with Monaco Editor

import * as monaco from 'monaco-editor';

// Configure Monaco Editor worker URLs
self.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    if (label === 'json') {
      return './assets/monaco-editor/vs/language/json/json.worker.js';
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return './assets/monaco-editor/vs/language/css/css.worker.js';
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return './assets/monaco-editor/vs/language/html/html.worker.js';
    }
    if (label === 'typescript' || label === 'javascript') {
      return './assets/monaco-editor/vs/language/typescript/ts.worker.js';
    }
    return './assets/monaco-editor/vs/editor/editor.worker.js';
  }
};

class Editor {
  constructor(container) {
    this.container = container;
    this.currentFile = null;
    this.content = '';
    this.editor = null;
    
    // Initialize editor
    this.init();
  }
  
  // Initialize the Monaco editor
  init() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create editor
    this.editor = monaco.editor.create(this.container, {
      value: '',
      theme: window.settings?.theme === 'light' ? 'vs' : 'vs-dark',
      automaticLayout: true,
      fontSize: window.settings?.fontSize || 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      minimap: {
        enabled: true
      },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: window.settings?.tabSize || 2,
      insertSpaces: true,
      renderWhitespace: 'selection',
      renderControlCharacters: false,
      renderLineHighlight: 'line',
      renderIndentGuides: true,
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        useShadows: false,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        verticalScrollbarSize: 12,
        horizontalScrollbarSize: 12
      }
    });
    
    // Add content change listener
    this.editor.onDidChangeModelContent(() => {
      this.content = this.editor.getValue();
      
      // Update current file if available
      if (this.currentFile) {
        this.currentFile.content = this.content;
      }
    });
    
    // Set initial content
    this.setContent('');
  }
  
  // Set the content of the editor
  setContent(content) {
    this.content = content;
    if (this.editor) {
      this.editor.setValue(content);
    }
  }
  
  // Get the content of the editor
  getContent() {
    if (this.editor) {
      return this.editor.getValue();
    }
    return this.content;
  }
  
  // Set the current file
  setCurrentFile(file) {
    this.currentFile = file;
    this.setContent(file.content);
    
    // Set language based on file extension
    if (this.editor) {
      const language = this.getLanguageFromFileName(file.name);
      const model = this.editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language);
      }
    }
    
    // Set focus
    if (this.editor) {
      this.editor.focus();
    }
  }
  
  // Get language from file name
  getLanguageFromFileName(fileName) {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'scss',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'md': 'markdown',
      'markdown': 'markdown',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cxx': 'cpp',
      'cc': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell',
      'ps1': 'powershell',
      'sql': 'sql',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'ini': 'ini',
      'conf': 'ini',
      'config': 'ini'
    };
    
    return languageMap[extension] || 'plaintext';
  }
  
  // Destroy the editor
  destroy() {
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
  }
  
  // Focus the editor
  focus() {
    if (this.editor) {
      this.editor.focus();
    }
  }
  
  // Get the current selection
  getSelection() {
    if (this.editor) {
      return this.editor.getSelection();
    }
    return null;
  }
  
  // Set the selection
  setSelection(selection) {
    if (this.editor && selection) {
      this.editor.setSelection(selection);
    }
  }
  
  // Get the current position
  getPosition() {
    if (this.editor) {
      return this.editor.getPosition();
    }
    return null;
  }
  
  // Set the position
  setPosition(position) {
    if (this.editor && position) {
      this.editor.setPosition(position);
    }
  }
  
  // Toggle word wrap
  toggleWordWrap() {
    if (this.editor) {
      const wordWrap = this.editor.getOption(monaco.editor.EditorOption.wordWrap);
      this.editor.updateOptions({
        wordWrap: wordWrap === 'on' ? 'off' : 'on'
      });
    }
  }
  
  // Toggle minimap
  toggleMinimap() {
    if (this.editor) {
      const minimap = this.editor.getOption(monaco.editor.EditorOption.minimap);
      this.editor.updateOptions({
        minimap: {
          enabled: !minimap.enabled
        }
      });
    }
  }
}

export default Editor;