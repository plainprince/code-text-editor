// outline.js - Handles document outline functionality

import * as monaco from 'monaco-editor';

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

    // Define icons for different symbol types
    this.symbolIcons = {
      [monaco.languages.SymbolKind.File]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
      [monaco.languages.SymbolKind.Module]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
      [monaco.languages.SymbolKind.Namespace]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
      [monaco.languages.SymbolKind.Package]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
      [monaco.languages.SymbolKind.Class]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><circle cx="12" cy="12" r="4"></circle></svg>',
      [monaco.languages.SymbolKind.Method]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      [monaco.languages.SymbolKind.Property]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
      [monaco.languages.SymbolKind.Field]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="8" rx="1"></rect><path d="M17 14v7"></path><path d="M7 14v7"></path><path d="M17 3v3"></path><path d="M7 3v3"></path></svg>',
      [monaco.languages.SymbolKind.Constructor]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path></svg>',
      [monaco.languages.SymbolKind.Enum]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M9 9h6v6H9z"></path></svg>',
      [monaco.languages.SymbolKind.Interface]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
      [monaco.languages.SymbolKind.Function]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"></path><path d="M21 12c.552 0 1-.448 1-1V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6c0 .552.448 1 1 1"></path><path d="M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6z"></path></svg>',
      [monaco.languages.SymbolKind.Variable]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20V4h5a3 3 0 0 1 0 6h-5m0 0h5a3 3 0 0 1 0 6H7"></path></svg>',
      [monaco.languages.SymbolKind.Constant]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10,8 16,12 10,16 10,8"></polygon></svg>',
      [monaco.languages.SymbolKind.String]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z"></path></svg>',
      [monaco.languages.SymbolKind.Number]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>',
      [monaco.languages.SymbolKind.Boolean]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"></path><path d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z"></path></svg>',
      [monaco.languages.SymbolKind.Array]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v18M18 3v18"></path><path d="M6 12h12"></path></svg>',
      [monaco.languages.SymbolKind.Object]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>',
      [monaco.languages.SymbolKind.Key]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>',
      [monaco.languages.SymbolKind.Null]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M4.93 4.93l14.14 14.14"></path></svg>',
      [monaco.languages.SymbolKind.EnumMember]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><circle cx="12" cy="12" r="4"></circle></svg>',
      [monaco.languages.SymbolKind.Struct]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
      [monaco.languages.SymbolKind.Event]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>',
      [monaco.languages.SymbolKind.Operator]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
      [monaco.languages.SymbolKind.TypeParameter]: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z"></path></svg>'
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
    this.currentModel = editor ? editor.getModel() : null;

    // Set up listeners for content changes
    if (this.currentModel) {
      this.currentModel.onDidChangeContent(() => {
        // Debounce updates to avoid too frequent re-rendering
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => {
          this.updateOutline();
        }, 500);
      });

      // Initial update
      this.updateOutline();
    } else {
      this.clearOutline();
    }
  }

  // Update the outline using Tree-sitter in Rust backend
  async updateOutline() {
    if (!this.currentModel) {
      this.clearOutline();
      return;
    }
/* 
    if (!window.__TAURI__ || !window.__TAURI__.tauri) {
      console.error('Tauri not available - Tree-sitter requires Tauri backend');
      this.clearOutline();
      return;
    } */

    const languageId = this.currentModel.getLanguageId();
    const fileName = this.currentModel.uri.path;
    const sourceCode = this.currentModel.getValue();

        try {
      // Call Rust backend for Tree-sitter parsing
      const symbols = await invoke('parse_document_symbols', {
        sourceCode,
        languageId,
        filePath: fileName
      });

      console.log(`Tree-sitter parsed ${symbols.length} symbols for ${languageId}`);
      console.log('Raw symbols from Tree-sitter:', symbols);
      this.symbols = symbols;
      this.renderOutline();

    } catch (error) {
      console.error('Tree-sitter parsing failed:', error);
      this.clearOutline();
    }
  }

  // Tree-sitter parsing is now handled in Rust backend for better performance

  // Basic symbol parsing as fallback
  parseBasicSymbols() {
    if (!this.currentModel) return [];

    const content = this.currentModel.getValue();
    const lines = content.split('\n');
    const symbols = [];
    const symbolStack = []; // Stack to track nested containers

    // Simple regex patterns for common symbols
    const patterns = [
      // Class declarations (higher priority)
      { kind: monaco.languages.SymbolKind.Class, regex: /^(\s*)(?:export\s+)?class\s+(\w+)/, mustBeIndented: false },
      { kind: monaco.languages.SymbolKind.Interface, regex: /^(\s*)(?:export\s+)?interface\s+(\w+)/, mustBeIndented: false },
      { kind: monaco.languages.SymbolKind.Enum, regex: /^(\s*)(?:export\s+)?enum\s+(\w+)/, mustBeIndented: false },

      // Methods (must be indented)
      { kind: monaco.languages.SymbolKind.Method, regex: /^(\s+)(constructor)\s*\([^)]*\)/, mustBeIndented: true },
      { kind: monaco.languages.SymbolKind.Method, regex: /^(\s+)(?:static\s+)?(\w+)\s*\([^)]*\)/, mustBeIndented: true },
      { kind: monaco.languages.SymbolKind.Method, regex: /^(\s+)(?:async\s+)?(\w+)\s*\([^)]*\)/, mustBeIndented: true },

      // Functions (top-level)
      { kind: monaco.languages.SymbolKind.Function, regex: /^(\s*)(?:export\s+)?(?:async\s+)?function\s+(\w+)/, mustBeIndented: false },
      { kind: monaco.languages.SymbolKind.Function, regex: /^(\s*)(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/, mustBeIndented: false },

      // Variables
      { kind: monaco.languages.SymbolKind.Variable, regex: /^(\s*)(?:const|let|var)\s+(\w+)\s*=/, mustBeIndented: false },
      { kind: monaco.languages.SymbolKind.Variable, regex: /^(\s*)(?:export\s+)?(?:const|let|var)\s+(\w+)/, mustBeIndented: false }
    ];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
        return;
      }

      // Calculate indentation level
      const indent = line.length - line.trimStart().length;

      // Pop from stack if we've moved to a less indented level
      while (symbolStack.length > 0 && symbolStack[symbolStack.length - 1].indent >= indent) {
        symbolStack.pop();
      }

      // Check for closing braces to pop containers
      if (trimmedLine === '}' && symbolStack.length > 0) {
        symbolStack.pop();
        return;
      }

      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          // Check if this pattern requires indentation
          if (pattern.mustBeIndented && indent === 0) {
            continue; // Skip if it should be indented but isn't
          }

          // Extract symbol name from match group 2
          const symbolName = match[2];

          const symbol = {
            name: symbolName,
            kind: pattern.kind,
            range: new monaco.Range(index + 1, 1, index + 1, line.length),
            selectionRange: new monaco.Range(index + 1, match.index + match[1].length + 1, index + 1, line.length),
            children: []
          };

          // Determine where to place this symbol
          if (symbolStack.length === 0) {
            // Top-level symbol
            symbols.push(symbol);
          } else {
            // Nested symbol - add to the current container
            const parent = symbolStack[symbolStack.length - 1].symbol;
            parent.children.push(symbol);
          }

          // If this is a container type (class, interface, enum), add it to the stack
          const containerKinds = [
            monaco.languages.SymbolKind.Class,
            monaco.languages.SymbolKind.Interface,
            monaco.languages.SymbolKind.Enum,
            monaco.languages.SymbolKind.Namespace,
            monaco.languages.SymbolKind.Module
          ];

          if (containerKinds.includes(pattern.kind)) {
            symbolStack.push({
              symbol: symbol,
              indent: indent
            });
          }

          break;
        }
      }
    });

    return symbols;
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
    // Set base padding plus level-based indentation
    itemContainer.style.paddingLeft = `${8 + (level * 16)}px`;

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
    return this.symbolIcons[kind] || this.symbolIcons[monaco.languages.SymbolKind.Variable];
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
    this.currentEditor.revealLineInCenter(symbol.range.startLineNumber);

    // Set cursor position to the symbol
    this.currentEditor.setPosition({
      lineNumber: symbol.range.startLineNumber,
      column: symbol.range.startColumn
    });

    // Focus the editor
    this.currentEditor.focus();

    // Optionally select the symbol
    if (symbol.selectionRange) {
      this.currentEditor.setSelection(symbol.selectionRange);
    }
  }

  // Refresh the outline
  refresh() {
    this.updateOutline();
  }
}

export default OutlinePanel;