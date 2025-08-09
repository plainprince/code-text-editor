// codemirror-editor.js - CodeMirror 6 editor implementation with custom theming

import { EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, keymap, placeholder, scrollPastEnd } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { foldGutter, indentOnInput, bracketMatching, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, snippetCompletion, CompletionContext } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { oneDark } from '@codemirror/theme-one-dark';
import { indentWithTab } from '@codemirror/commands';

import { createCodeMirrorTheme, getCurrentTheme } from './theme-system.js';

class CodeMirrorEditor {
  constructor(container) {
    this.container = container;
    this.currentFile = null;
    this.content = '';
    this.editor = null;
    this.view = null;
    
    // Compartments for reconfigurable extensions
    this.themeCompartment = new Compartment();
    this.languageCompartment = new Compartment();
    
    // Initialize editor
    this.init();
    
    // Force refresh after a short delay to ensure proper rendering
    setTimeout(() => {
      this.refresh();
    }, 100);
  }
  
  // Initialize the CodeMirror editor
  init() {
    // Clear container
    this.container.innerHTML = '';
    
    // Get current theme
    const themeConfig = getCurrentTheme();
    const themeExtensions = createCodeMirrorTheme(themeConfig);
    
    // Create editor state
    const state = EditorState.create({
      doc: '',
      extensions: [
        // Basic setup extensions (manual instead of basicSetup)
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({
          override: [this.createCompletionSources()],
          activateOnTyping: true,
          maxRenderedOptions: 10,
          defaultKeymap: true
        }),
        rectangularSelection(),
        
        // Scrolling configuration
        EditorView.scrollMargins.of(f => ({ top: 50, bottom: 50 })),
        
        // Allow scrolling past the end like VS Code
        scrollPastEnd(),
        
        // Ensure scrolling is enabled
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' }
        }),
        
        
        // Proper click handling and mouse wheel scrolling
        EditorView.domEventHandlers({
          mousedown: (event, view) => {
            // Get the position where the click occurred
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos != null) {
              // Check if the click is beyond the document length
              const docLength = view.state.doc.length;
              if (pos > docLength) {
                // Place cursor at end of document instead
                view.dispatch({
                  selection: { anchor: docLength, head: docLength }
                });
                event.preventDefault();
                return true;
              }
              
              // Check if click is on an empty line below content
              const line = view.state.doc.lineAt(pos);
              const lineStart = line.from;
              const lineText = line.text;
              
              // If clicking beyond the actual text content on a line
              if (pos > lineStart + lineText.length && lineText.trim() === '') {
                // Place cursor at the end of the actual content
                view.dispatch({
                  selection: { anchor: lineStart, head: lineStart }
                });
                event.preventDefault();
                return true;
              }
            }
            return false;
          }
        }),
        
        // Theme
        this.themeCompartment.of(themeExtensions),
        
        // Language support (starts with plain text)
        this.languageCompartment.of([]),
        
        // Search highlighting
        highlightSelectionMatches(),
        
        // Key bindings
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab
        ]),
        
        // Content change listener and cursor tracking
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.content = this.view.state.doc.toString();
            
            // Update current file if available
            if (this.currentFile) {
              this.currentFile.content = this.content;
            }
            
            // Dispatch content change event for diagnostics
            document.dispatchEvent(new CustomEvent('editor-content-changed', {
              detail: {
                filePath: this.currentFile?.path,
                content: this.content
              }
            }));
          }
          
          // Note: Cursor scrolling is handled automatically by CodeMirror 6
          // Manual scrolling can cause issues, so we let CodeMirror handle it
        }),
        
        // Tab size and editor settings
        EditorState.tabSize.of(window.settings?.tabSize || 2),
        EditorView.lineWrapping,
        
        // Theme-based editor settings
        EditorView.theme({
          '.cm-editor': {
            fontSize: `${window.settings?.fontSize || 14}px`
          }
        })
      ]
    });
    
    // Create editor view
    this.view = new EditorView({
      state,
      parent: this.container
    });
    
    // Store reference for compatibility
    this.editor = {
      // Monaco-like API for compatibility
      getValue: () => this.getContent(),
      setValue: (content) => this.setContent(content),
      getModel: () => null, // Not applicable to CodeMirror
      getPosition: () => this.getPosition(),
      setPosition: (position) => this.setPosition(position),
      getSelection: () => this.getSelection(),
      setSelection: (selection) => this.setSelection(selection),
      focus: () => this.focus(),
      revealLineInCenter: (lineNumber) => this.revealLineInCenter(lineNumber),
      updateOptions: (options) => this.updateOptions(options),
      onDidChangeModelContent: (callback) => {
        // Store callback for compatibility - actual listener is in updateListener above
        this._contentChangeCallback = callback;
      }
    };
    
    // Set initial content
    this.setContent('');
  }
  
  // Set the content of the editor
  setContent(content) {
    // Ensure content is a valid string
    const validContent = content != null ? String(content) : '';
    this.content = validContent;
    
    if (this.view) {
      this.view.dispatch({
        changes: {
          from: 0,
          to: this.view.state.doc.length,
          insert: validContent
        }
      });
    }
  }
  
  // Get the content of the editor
  getContent() {
    if (this.view) {
      return this.view.state.doc.toString();
    }
    return this.content;
  }
  
  // Set the current file and update language
  setCurrentFile(file) {
    this.currentFile = file;
    
    // Set language based on file extension
    if (this.view) {
      const language = this.getLanguageFromFileName(file.name);
      this.setLanguage(language);
    }
    
    // Set focus
    this.focus();
  }
  
  // Set the language mode
  setLanguage(languageName) {
    if (!this.view) return;
    
    let languageExtension = [];
    
    switch (languageName) {
      case 'javascript':
      case 'jsx':
        languageExtension = [javascript({ jsx: languageName === 'jsx' })];
        break;
      case 'typescript':
      case 'tsx':
        languageExtension = [javascript({ typescript: true, jsx: languageName === 'tsx' })];
        break;
      case 'html':
        languageExtension = [html()];
        break;
      case 'css':
      case 'scss':
      case 'less':
        languageExtension = [css()];
        break;
      case 'json':
        languageExtension = [json()];
        break;
      case 'markdown':
        languageExtension = [markdown()];
        break;
      case 'python':
        languageExtension = [python()];
        break;
      case 'rust':
        languageExtension = [rust()];
        break;
      case 'go':
        languageExtension = [go()];
        break;
      case 'cpp':
      case 'c':
        languageExtension = [cpp()];
        break;
      case 'java':
        languageExtension = [java()];
        break;
      case 'php':
        languageExtension = [php()];
        break;
      default:
        languageExtension = []; // Plain text
    }
    
    // Update language compartment
    this.view.dispatch({
      effects: this.languageCompartment.reconfigure(languageExtension)
    });
  }
  
  // Get language from file name
  getLanguageFromFileName(fileName) {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const languageMap = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'scss',
      'less': 'less',
      'json': 'json',
      'xml': 'html', // Use HTML parser for XML
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
      'cs': 'csharp', // Not supported yet, falls back to plain text
      'php': 'php',
      'rb': 'ruby', // Not supported yet, falls back to plain text
      'go': 'go',
      'rs': 'rust',
      'sh': 'shell', // Not supported yet, falls back to plain text
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell',
      'ps1': 'powershell', // Not supported yet, falls back to plain text
      'sql': 'sql', // Not supported yet, falls back to plain text
      'yaml': 'yaml', // Not supported yet, falls back to plain text
      'yml': 'yaml',
      'toml': 'toml', // Not supported yet, falls back to plain text
      'ini': 'ini', // Not supported yet, falls back to plain text
      'conf': 'ini',
      'config': 'ini'
    };
    
    return languageMap[extension] || 'plaintext';
  }
  
  // Update theme
  updateTheme() {
    if (!this.view) return;
    
    const themeConfig = getCurrentTheme();
    const themeExtensions = createCodeMirrorTheme(themeConfig);
    
    this.view.dispatch({
      effects: this.themeCompartment.reconfigure(themeExtensions)
    });
  }
  
  // Update editor options (for compatibility with Monaco API)
  updateOptions(options) {
    if (!this.view) return;
    
    const effects = [];
    
    // Handle font size
    if (options.fontSize) {
      const fontSizeTheme = EditorView.theme({
        '.cm-editor': {
          fontSize: `${options.fontSize}px`
        }
      });
      effects.push(this.themeCompartment.reconfigure([
        ...createCodeMirrorTheme(getCurrentTheme()),
        fontSizeTheme
      ]));
    }
    
    // Handle tab size
    if (options.tabSize) {
      effects.push(EditorState.tabSize.reconfigure(EditorState.tabSize.of(options.tabSize)));
    }
    
    if (effects.length > 0) {
      this.view.dispatch({ effects });
    }
  }
  
  // Get current cursor position
  getPosition() {
    if (!this.view) return null;
    
    const pos = this.view.state.selection.main.head;
    const line = this.view.state.doc.lineAt(pos);
    
    return {
      lineNumber: line.number,
      column: pos - line.from + 1
    };
  }
  
  // Set cursor position
  setPosition(position) {
    if (!this.view || !position) return;
    
    try {
      const line = this.view.state.doc.line(position.lineNumber);
      const pos = line.from + Math.min(position.column - 1, line.length);
      
      this.view.dispatch({
        selection: { anchor: pos, head: pos },
        scrollIntoView: true
      });
    } catch (e) {
      console.warn('Invalid position:', position);
    }
  }
  
  // Get current selection
  getSelection() {
    if (!this.view) return null;
    
    const selection = this.view.state.selection.main;
    const doc = this.view.state.doc;
    
    const startLine = doc.lineAt(selection.from);
    const endLine = doc.lineAt(selection.to);
    
    return {
      startLineNumber: startLine.number,
      startColumn: selection.from - startLine.from + 1,
      endLineNumber: endLine.number,
      endColumn: selection.to - endLine.from + 1
    };
  }
  
  // Set selection
  setSelection(selection) {
    if (!this.view || !selection) return;
    
    try {
      const doc = this.view.state.doc;
      const startLine = doc.line(selection.startLineNumber);
      const endLine = doc.line(selection.endLineNumber);
      
      const from = startLine.from + Math.min(selection.startColumn - 1, startLine.length);
      const to = endLine.from + Math.min(selection.endColumn - 1, endLine.length);
      
      this.view.dispatch({
        selection: { anchor: from, head: to },
        scrollIntoView: true
      });
    } catch (e) {
      console.warn('Invalid selection:', selection);
    }
  }
  
  // Reveal line in center
  revealLineInCenter(lineNumber) {
    if (!this.view) return;
    
    try {
      const line = this.view.state.doc.line(lineNumber);
      const pos = line.from;
      
      this.view.dispatch({
        selection: { anchor: pos, head: pos },
        effects: EditorView.scrollIntoView(pos, { y: 'center' })
      });
    } catch (e) {
      console.warn('Invalid line number:', lineNumber);
    }
  }
  
  // Focus the editor
  focus() {
    if (this.view) {
      this.view.focus();
    }
  }
  
  // Refresh the editor (force recalculation of dimensions)
  refresh() {
    if (this.view) {
      // Force CodeMirror to recalculate its dimensions
      this.view.requestMeasure();
    }
  }
  
  // Custom completion sources for better autocompletion
  createCompletionSources() {
    const jsCompletions = [
      snippetCompletion("console.log(#{cursor})", { label: "console.log", type: "function" }),
      snippetCompletion("function #{name}(#{params}) {\n\t#{cursor}\n}", { label: "function", type: "keyword" }),
      snippetCompletion("const #{name} = #{cursor}", { label: "const", type: "keyword" }),
      snippetCompletion("let #{name} = #{cursor}", { label: "let", type: "keyword" }),
      snippetCompletion("if (#{condition}) {\n\t#{cursor}\n}", { label: "if", type: "keyword" }),
      snippetCompletion("for (let #{i} = 0; #{i} < #{length}; #{i}++) {\n\t#{cursor}\n}", { label: "for", type: "keyword" }),
      snippetCompletion("try {\n\t#{cursor}\n} catch (error) {\n\tconsole.error(error);\n}", { label: "try-catch", type: "keyword" }),
      snippetCompletion("async function #{name}(#{params}) {\n\t#{cursor}\n}", { label: "async function", type: "keyword" }),
      snippetCompletion("await #{cursor}", { label: "await", type: "keyword" }),
      snippetCompletion("import { #{imports} } from '#{module}';", { label: "import destructured", type: "keyword" }),
      snippetCompletion("import #{name} from '#{module}';", { label: "import default", type: "keyword" }),
      snippetCompletion("export { #{exports} };", { label: "export destructured", type: "keyword" }),
      snippetCompletion("export default #{cursor}", { label: "export default", type: "keyword" })
    ];
    
    const htmlCompletions = [
      snippetCompletion("<div>#{cursor}</div>", { label: "div", type: "element" }),
      snippetCompletion("<span>#{cursor}</span>", { label: "span", type: "element" }),
      snippetCompletion("<p>#{cursor}</p>", { label: "p", type: "element" }),
      snippetCompletion("<h1>#{cursor}</h1>", { label: "h1", type: "element" }),
      snippetCompletion("<h2>#{cursor}</h2>", { label: "h2", type: "element" }),
      snippetCompletion("<a href=\"#{url}\">#{cursor}</a>", { label: "a", type: "element" }),
      snippetCompletion("<img src=\"#{url}\" alt=\"#{alt}\">", { label: "img", type: "element" }),
      snippetCompletion("<input type=\"#{type}\" value=\"#{cursor}\">", { label: "input", type: "element" }),
      snippetCompletion("<button onclick=\"#{cursor}\">Button</button>", { label: "button", type: "element" })
    ];

    const cssCompletions = [
      snippetCompletion("display: #{cursor};", { label: "display", type: "property" }),
      snippetCompletion("flex-direction: #{cursor};", { label: "flex-direction", type: "property" }),
      snippetCompletion("justify-content: #{cursor};", { label: "justify-content", type: "property" }),
      snippetCompletion("align-items: #{cursor};", { label: "align-items", type: "property" }),
      snippetCompletion("background-color: #{cursor};", { label: "background-color", type: "property" }),
      snippetCompletion("border-radius: #{cursor};", { label: "border-radius", type: "property" }),
      snippetCompletion("margin: #{cursor};", { label: "margin", type: "property" }),
      snippetCompletion("padding: #{cursor};", { label: "padding", type: "property" })
    ];
    
    return (context) => {
      const filename = this.currentFile?.name || '';
      let completions = [];
      
      if (filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.jsx') || filename.endsWith('.tsx')) {
        completions = jsCompletions;
      } else if (filename.endsWith('.html') || filename.endsWith('.htm')) {
        completions = htmlCompletions;
      } else if (filename.endsWith('.css') || filename.endsWith('.scss') || filename.endsWith('.sass')) {
        completions = cssCompletions;
      }
      
      const word = context.matchBefore(/\w*/);
      if (word && word.from !== word.to && word.text.length > 0) {
        return {
          from: word.from,
          options: completions
        };
      }
      
      return null;
    };
  }
  
  // Destroy the editor
  destroy() {
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
    this.editor = null;
  }
  
  // Toggle word wrap (for compatibility)
  toggleWordWrap() {
    // CodeMirror 6 has word wrap enabled by default with EditorView.lineWrapping
    // This is just for compatibility with the Monaco API
    console.log('Word wrap toggle - CodeMirror 6 has line wrapping enabled by default');
  }
  
  // Toggle minimap (for compatibility)
  toggleMinimap() {
    // CodeMirror 6 doesn't have a built-in minimap like Monaco
    // This is just for compatibility with the Monaco API
    console.log('Minimap toggle - CodeMirror 6 does not have a built-in minimap');
  }
}

export default CodeMirrorEditor;
