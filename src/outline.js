// outline.js - Handles document outline functionality

// Outline panel now works with CodeMirror instead of Monaco

import { invoke } from '@tauri-apps/api/core';

class OutlinePanel {
  constructor() {
    this.container = document.querySelector("#outline-panel .sidebar-panel-content");
    this.currentEditor = null;
    this.currentModel = null;
    this.symbols = [];
    this.expandedNodes = new Set(); // Track expanded/collapsed state
    this.updateTimeout = null;
    this.parser = null;
    this.languages = new Map();
    this.isTreeSitterReady = false;

    // Define icons for different symbol types (using string constants instead of Monaco SymbolKind)
    this.symbolIcons = {
      'file': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
      'module': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
      'namespace': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
      'package': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
      'class': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><circle cx="12" cy="12" r="4"></circle></svg>',
      'method': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      'property': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
      'field': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="8" rx="1"></rect><path d="M17 14v7"></path><path d="M7 14v7"></path><path d="M17 3v3"></path><path d="M7 3v3"></path></svg>',
      'constructor': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path></svg>',
      'enum': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M9 9h6v6H9z"></path></svg>',
      'interface': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
      'function': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"></path><path d="M21 12c.552 0 1-.448 1-1V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6c0 .552.448 1 1 1"></path><path d="M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6z"></path></svg>',
      'variable': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20V4h5a3 3 0 0 1 0 6h-5m0 0h5a3 3 0 0 1 0 6H7"></path></svg>',
      'constant': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10,8 16,12 10,16 10,8"></polygon></svg>',
      'string': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z"></path></svg>',
      'number': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>',
      'boolean': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"></path><path d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z"></path></svg>',
      'array': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v18M18 3v18"></path><path d="M6 12h12"></path></svg>',
      'object': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>',
      'key': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>',
      'null': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M4.93 4.93l14.14 14.14"></path></svg>',
      'enummember': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><circle cx="12" cy="12" r="4"></circle></svg>',
      'struct': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
      'event': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>',
      'operator': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
      'typeparameter': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z"></path></svg>'
    };

    // Bind methods
    this.updateOutline = this.updateOutline.bind(this);
    this.renderOutline = this.renderOutline.bind(this);
    this.setEditor = this.setEditor.bind(this);

    // Initialize Tree-sitter (async)
    this.initializeTreeSitter().catch(error => {
      console.warn('Tree-sitter initialization failed, using fallback:', error);
    });
  }

  // Initialize Tree-sitter parser and languages
  async initializeTreeSitter() {
    this.isTreeSitterReady = true;

    // Update outline if we already have an editor
    if (this.currentEditor) {
      this.updateOutline();
    }
  }

  // Set the current editor instance
  setEditor(editor) {
    this.currentEditor = editor;

    // Set up listeners for content changes
    if (this.currentEditor) {
      // Listen to the editor-content-changed event that CodeMirror dispatches
      document.addEventListener('editor-content-changed', this.handleContentChange.bind(this));
      
      // Initial update
      this.updateOutline();
    } else {
      document.removeEventListener('editor-content-changed', this.handleContentChange.bind(this));
      this.clearOutline();
    }
  }

  // Handle content changes from CodeMirror
  handleContentChange(event) {
    // Debounce updates to avoid too frequent re-rendering
    clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => {
      this.updateOutline();
    }, 500);
  }

  // Update the outline using Tree-sitter in Rust backend
  async updateOutline() {
    if (!this.currentEditor) {
      this.clearOutline();
      return;
    }
/* 
    if (!window.__TAURI__ || !window.__TAURI__.tauri) {
      console.error('Tauri not available - Tree-sitter requires Tauri backend');
      this.clearOutline();
      return;
    } */

    // Get data from CodeMirror editor
    const fileName = this.currentEditor.currentFile?.name || 'untitled';
    const sourceCode = this.currentEditor.content || '';
    const languageId = this.getLanguageFromFileName(fileName);
    const queries = []; // No longer using keyword queries - Tree-sitter handles everything

        try {
      // Debug Tauri availability
      console.log('Checking Tauri availability:');
      console.log('window.__TAURI__:', typeof window.__TAURI__);
      console.log('window.__TAURI__.core:', typeof window.__TAURI__?.core);
      
      // Try Rust backend for Tree-sitter parsing first
      if (window.__TAURI__ && window.__TAURI__.core) {
        console.log('✅ Tauri available - calling Tree-sitter');
        console.log('Calling Tree-sitter with:', { 
          sourceCode: sourceCode.length + ' chars', 
          languageId, 
          fileName 
        });
        console.log('Source code preview:', sourceCode.substring(0, 200) + '...');
        
        const symbols = await window.__TAURI__.core.invoke('parse_document_symbols', {
          source_code: sourceCode,
          language_id: languageId,
          file_path: fileName,
          queries: queries
        });

        console.log(`✅ Tree-sitter parsed ${symbols.length} symbols for ${languageId}`);
        console.log('Tree-sitter symbols:', symbols);
        this.symbols = symbols;
        this.renderOutline();
        return;
      } else {
        console.log('❌ Tauri not available. Outline will not be populated.');
        this.clearOutline();
      }
    } catch (error) {
      console.error('❌ Tree-sitter parsing failed:', error);
      this.clearOutline();
    }
  }

  // Get language ID from filename
  getLanguageFromFileName(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'java': 'java',
      'php': 'php',
      'rb': 'ruby',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown'
    };
    return languageMap[ext] || 'plaintext';
  }

    getKeywordConfigForLanguage(languageId) {
    // Get current theme configuration
    const themes = {
      dark: {
        customKeywords: {
          jsKeywords: ["const", "let", "var", "function", "class", "extends", "implements", "interface", "type", "enum"],
          jsBuiltins: ["console", "window", "document", "localStorage", "sessionStorage", "fetch", "Promise"],
          pythonKeywords: ["def", "class", "import", "from", "as", "with", "lambda", "yield", "async", "await"],
          pythonBuiltins: ["print", "len", "range", "enumerate", "zip", "map", "filter", "reduce"],
          rustKeywords: ["fn", "struct", "enum", "impl", "trait", "mod", "use", "pub", "mut", "let"],
          rustBuiltins: ["Vec", "HashMap", "Option", "Result", "String", "str"],
          goKeywords: ["func", "struct", "interface", "type", "var", "const", "package", "import"],
          goBuiltins: ["fmt", "log", "http", "json", "time", "context"],
          controlFlow: ["if", "else", "elif", "for", "while", "switch", "case", "break", "continue", "return"],
          types: ["int", "float", "string", "bool", "array", "object", "null", "undefined"]
        }
      }
    };

    const keywords = themes.dark.customKeywords;

    if (languageId === 'javascript' || languageId === 'typescript') {
      return {
        keywords: [
          // Only include function and class declarations for typical outline behavior
          { type: "function", keyword: "function", useRegex: false },
          { type: "class", keyword: "class", useRegex: false },
          { type: "function", keyword: "const.*=.*=>", useRegex: true }, // arrow functions
          { type: "function", keyword: "const.*=.*function", useRegex: true }, // function expressions
        ],
        builtins: [
          // Add regex support for console methods
          { type: "function", keyword: "console\\..*", useRegex: true },
          // Add other common patterns with regex
          { type: "function", keyword: "Math\\..*", useRegex: true },
          { type: "function", keyword: "JSON\\..*", useRegex: true },
          { type: "function", keyword: "Object\\..*", useRegex: true },
          { type: "function", keyword: "Array\\..*", useRegex: true }
        ]
      };
    } else if (languageId === 'python') {
      return {
        keywords: [
          { type: "function", keyword: "def", useRegex: false },
          { type: "class", keyword: "class", useRegex: false },
        ],
        builtins: [
          // Python method calls
          { type: "function", keyword: "print\\(", useRegex: true },
          { type: "function", keyword: ".*\\.append\\(", useRegex: true },
          { type: "function", keyword: ".*\\.join\\(", useRegex: true },
        ]
      };
    } else if (languageId === 'rust') {
      return {
        keywords: [
          { type: "function", keyword: "fn", useRegex: false },
          { type: "class", keyword: "struct", useRegex: false },
          { type: "class", keyword: "enum", useRegex: false },
          { type: "class", keyword: "impl", useRegex: false },
        ],
        builtins: [
          // Rust specific patterns
          { type: "function", keyword: "println!", useRegex: false },
          { type: "function", keyword: ".*::.*\\(", useRegex: true }, // method calls
        ]
      };
    } else if (languageId === 'go') {
      return {
        keywords: [
          { type: "function", keyword: "func", useRegex: false },
          { type: "class", keyword: "struct", useRegex: false },
          { type: "class", keyword: "interface", useRegex: false },
          { type: "class", keyword: "type", useRegex: false },
        ],
        builtins: [
          // Go specific patterns
          { type: "function", keyword: "fmt\\..*\\(", useRegex: true }
        ]
      };
    }
    
    return { keywords: [], builtins: [] };
  }

  getQueriesForLanguage(languageId) {
    // Convert keyword config to the format expected by Rust backend
    const config = this.getKeywordConfigForLanguage(languageId);
    
    // Flatten into a single array for the backend
    const queries = [];
    
    // Add keywords
    config.keywords.forEach(item => {
      queries.push({
        kind: item.type,
        keyword: item.keyword,
        useRegex: item.useRegex || false
      });
    });
    
    // Add builtins
    config.builtins.forEach(item => {
      queries.push({
        kind: item.type,
        keyword: item.keyword,
        useRegex: item.useRegex || false
      });
    });
    
    return queries;
  }

  // Clear the outline
  clearOutline() {
    this.symbols = [];
    this.container.innerHTML = '<div class="empty-message">No symbols found</div>';
  }

  // Render the outline tree
  renderOutline() {
    this.container.innerHTML = '';

    if (!this.symbols || this.symbols.length === 0) {
      this.container.innerHTML = '<div class="empty-message">No symbols found</div>';
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'outline-tree';

    this.symbols.forEach(symbol => {
      const li = this.createSymbolItem(symbol);
      ul.appendChild(li);
    });

    this.container.appendChild(ul);
  }

  // Create a symbol tree item
  createSymbolItem(symbol, level = 0) {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.dataset.symbolName = symbol.name;
    li.dataset.symbolKind = symbol.kind;

    // Create item container
    const itemContainer = document.createElement('div');
    itemContainer.className = 'outline-item-content';
    // Set base padding plus level-based indentation (24px per level for proper tab-like indentation)
    itemContainer.style.paddingLeft = `${8 + (level * 24)}px`;

    // Add expand/collapse arrow for items with children
    const hasChildren = symbol.children && symbol.children.length > 0;
    if (hasChildren) {
      const arrow = document.createElement('span');
      arrow.className = 'outline-arrow expanded'; // Default to expanded
      arrow.innerHTML = '▼';
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleExpanded(li, symbol);
      });
      itemContainer.appendChild(arrow);

      // Store expanded state
      this.expandedNodes.add(this.getSymbolId(symbol));
    } else {
      // Add spacing for items without children
      const spacer = document.createElement('span');
      spacer.className = 'outline-spacer';
      spacer.style.width = '16px';
      spacer.style.display = 'inline-block';
      itemContainer.appendChild(spacer);
    }

    // Add icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'outline-icon';
    iconSpan.innerHTML = this.getSymbolIcon(symbol.kind);
    itemContainer.appendChild(iconSpan);

    // Add name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'outline-name';
    nameSpan.textContent = symbol.name;
    itemContainer.appendChild(nameSpan);

    // Add click handler to navigate to symbol
    itemContainer.addEventListener('click', () => {
      this.navigateToSymbol(symbol);
    });

    li.appendChild(itemContainer);

    // Add children if any and if expanded
    if (hasChildren) {
      const childUl = document.createElement('ul');
      childUl.className = 'outline-tree';

      symbol.children.forEach(childSymbol => {
        const childLi = this.createSymbolItem(childSymbol, level + 1);
        childUl.appendChild(childLi);
      });

      li.appendChild(childUl);
    }

    return li;
  }

  // Get icon for symbol kind
  getSymbolIcon(kind) {
    // Ensure kind is a string and lowercase
    const normalizedKind = String(kind || '').toLowerCase();
    return this.symbolIcons[normalizedKind] || this.symbolIcons['variable'];
  }

  // Get unique identifier for symbol
  getSymbolId(symbol) {
    return `${symbol.name}_${symbol.kind}_${symbol.range.startLineNumber}`;
  }

  // Toggle expanded/collapsed state
  toggleExpanded(li, symbol) {
    const arrow = li.querySelector('.outline-arrow');
    const childUl = li.querySelector('ul');
    const symbolId = this.getSymbolId(symbol);

    if (this.expandedNodes.has(symbolId)) {
      // Collapse
      arrow.innerHTML = '▶';
      arrow.classList.remove('expanded');
      arrow.classList.add('collapsed');
      if (childUl) childUl.style.display = 'none';
      this.expandedNodes.delete(symbolId);
    } else {
      // Expand
      arrow.innerHTML = '▼';
      arrow.classList.remove('collapsed');
      arrow.classList.add('expanded');
      if (childUl) childUl.style.display = 'block';
      this.expandedNodes.add(symbolId);
    }
  }

  // Navigate to symbol in editor
  navigateToSymbol(symbol) {
    if (!this.currentEditor || !symbol.range) return;

    // Reveal the symbol in the editor
    this.currentEditor.revealLineInCenter(symbol.range.start_line_number);

    // Set cursor position to the symbol
    this.currentEditor.setPosition({
      lineNumber: symbol.range.start_line_number,
      column: symbol.range.start_column
    });

    // Focus the editor
    this.currentEditor.focus();

    // Optionally select the symbol
    if (symbol.selectionRange) {
      this.currentEditor.setSelection({
        startLineNumber: symbol.selection_range.start_line_number,
        startColumn: symbol.selection_range.start_column,
        endLineNumber: symbol.selection_range.end_line_number,
        endColumn: symbol.selection_range.end_column
    });
    }
  }

  // Refresh the outline
  refresh() {
    this.updateOutline();
  }
}

export default OutlinePanel;