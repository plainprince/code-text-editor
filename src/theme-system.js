// theme-system.js - Manages CodeMirror themes with customizable keywords and colors

import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Default theme configuration
export const defaultThemes = {
  dark: {
    name: "Dark Theme",
    base: "dark",
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    caret: "#ffffff",
    selection: "#264f78",
    selectionMatch: "#094771",
    lineHighlight: "#2a2d2e",
    gutterBackground: "#1e1e1e",
    gutterForeground: "#858585",
    
    // Syntax highlighting colors
    syntax: {
      keyword: "#569cd6",
      string: "#ce9178",
      comment: "#6a9955",
      number: "#b5cea8",
      operator: "#d4d4d4",
      punctuation: "#d4d4d4",
      variable: "#9cdcfe",
      function: "#dcdcaa",
      type: "#4ec9b0",
      tag: "#569cd6",
      attribute: "#92c5f8",
      property: "#9cdcfe",
      constant: "#4fc1ff",
      error: "#f44747"
    },
    
    // Custom keywords for different categories
    customKeywords: {
      // JavaScript/TypeScript keywords
      jsKeywords: ["const", "let", "var", "function", "class", "extends", "implements", "interface", "type", "enum"],
      jsBuiltins: ["console", "window", "document", "localStorage", "sessionStorage", "fetch", "Promise"],
      
      // Python keywords  
      pythonKeywords: ["def", "class", "import", "from", "as", "with", "lambda", "yield", "async", "await"],
      pythonBuiltins: ["print", "len", "range", "enumerate", "zip", "map", "filter", "reduce"],
      
      // Rust keywords
      rustKeywords: ["fn", "struct", "enum", "impl", "trait", "mod", "use", "pub", "mut", "let"],
      rustBuiltins: ["Vec", "HashMap", "Option", "Result", "String", "str"],
      
      // Go keywords
      goKeywords: ["func", "struct", "interface", "type", "var", "const", "package", "import"],
      goBuiltins: ["fmt", "log", "http", "json", "time", "context"],
      
      // General programming concepts
      controlFlow: ["if", "else", "elif", "for", "while", "switch", "case", "break", "continue", "return"],
      types: ["int", "float", "string", "bool", "array", "object", "null", "undefined"]
    }
  },
  
  light: {
    name: "Light Theme",
    base: "light",
    background: "#ffffff",
    foreground: "#000000",
    caret: "#000000",
    selection: "#add6ff",
    selectionMatch: "#a8dadc",
    lineHighlight: "#f0f0f0",
    gutterBackground: "#ffffff",
    gutterForeground: "#237893",
    
    // Syntax highlighting colors
    syntax: {
      keyword: "#0000ff",
      string: "#a31515",
      comment: "#008000",
      number: "#098658",
      operator: "#000000",
      punctuation: "#000000",
      variable: "#001080",
      function: "#795e26",
      type: "#267f99",
      tag: "#800000",
      attribute: "#ff0000",
      property: "#001080",
      constant: "#0070c1",
      error: "#cd3131"
    },
    
    // Same custom keywords structure
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

// Create CodeMirror theme from theme configuration
export function createCodeMirrorTheme(themeConfig) {
  const { syntax, background, foreground, caret, selection, selectionMatch, lineHighlight, gutterBackground, gutterForeground } = themeConfig;
  
  // Create highlight style for syntax highlighting
  const highlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: syntax.keyword },
    { tag: tags.string, color: syntax.string },
    { tag: tags.comment, color: syntax.comment },
    { tag: tags.number, color: syntax.number },
    { tag: tags.operator, color: syntax.operator },
    { tag: tags.punctuation, color: syntax.punctuation },
    { tag: tags.variableName, color: syntax.variable },
    { tag: tags.function(tags.variableName), color: syntax.function },
    { tag: tags.typeName, color: syntax.type },
    { tag: tags.tagName, color: syntax.tag },
    { tag: tags.attributeName, color: syntax.attribute },
    { tag: tags.propertyName, color: syntax.property },
    { tag: tags.constant(tags.variableName), color: syntax.constant },
    { tag: tags.invalid, color: syntax.error, textDecoration: "underline" },
    
    // Built-in types and constants
    { tag: tags.bool, color: syntax.constant },
    { tag: tags.null, color: syntax.constant },
    { tag: tags.atom, color: syntax.constant },
    
    // Control flow
    { tag: tags.controlKeyword, color: syntax.keyword, fontWeight: "bold" },
    { tag: tags.definitionKeyword, color: syntax.keyword, fontWeight: "bold" },
    { tag: tags.modifier, color: syntax.keyword },
    
    // Comments variations
    { tag: tags.lineComment, color: syntax.comment, fontStyle: "italic" },
    { tag: tags.blockComment, color: syntax.comment, fontStyle: "italic" },
    { tag: tags.docComment, color: syntax.comment, fontWeight: "bold" },
    
    // String variations
    { tag: tags.regexp, color: syntax.string, fontWeight: "bold" },
    { tag: tags.escape, color: syntax.number },
    { tag: tags.special(tags.string), color: syntax.number },
    
    // Special highlighting for custom keywords (will be handled by custom extension)
    { tag: tags.className, color: syntax.type, fontWeight: "bold" },
    { tag: tags.namespace, color: syntax.type },
    { tag: tags.macroName, color: syntax.function, fontWeight: "bold" }
  ]);
  
  // Create editor theme
  const editorTheme = EditorView.theme({
    // Editor basics
    '&': {
      color: foreground,
      backgroundColor: background,
    },
    
    // Content area
    '.cm-content': {
      padding: '10px 0',
      caretColor: caret,
      fontSize: '14px',
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      lineHeight: '1.4',
      minHeight: '100%'
    },
    
    // Scroller - ensure proper scrolling behavior
    '.cm-scroller': {
      overflow: 'auto',
      overscrollBehavior: 'contain',
      flex: '1',
      minHeight: '0'
    },
    
    // Ensure the editor can be scrolled
    '.cm-editor': {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    },
    
    // Focused state
    '&.cm-focused .cm-content': {
      outline: 'none'
    },
    
    // Cursor
    '.cm-cursor, .cm-dropCursor': {
      borderLeft: `2px solid ${caret}`
    },
    
    // Selection
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: selection
    },
    
    // Search matches
    '.cm-searchMatch': {
      backgroundColor: selectionMatch,
      outline: `1px solid ${syntax.keyword}`
    },
    
    // Current line highlight
    '.cm-activeLine': {
      backgroundColor: lineHighlight
    },
    
    // Gutter (line numbers)
    '.cm-gutters': {
      backgroundColor: gutterBackground,
      color: gutterForeground,
      border: 'none',
      borderRight: `1px solid ${themeConfig.base === 'dark' ? '#464647' : '#cccccc'}`
    },
    
    '.cm-activeLineGutter': {
      backgroundColor: lineHighlight,
      color: foreground
    },
    
    // Line numbers
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px',
      minWidth: '20px'
    },
    
    // Fold markers
    '.cm-foldPlaceholder': {
      backgroundColor: themeConfig.base === 'dark' ? '#464647' : '#cccccc',
      border: 'none',
      color: foreground,
      borderRadius: '3px',
      padding: '0 4px'
    },
    
    // Scrollbars
    '.cm-scroller::-webkit-scrollbar': {
      width: '12px',
      height: '12px'
    },
    
    '.cm-scroller::-webkit-scrollbar-track': {
      backgroundColor: background
    },
    
    '.cm-scroller::-webkit-scrollbar-thumb': {
      backgroundColor: themeConfig.base === 'dark' ? '#464647' : '#cccccc',
      borderRadius: '6px'
    },
    
    '.cm-scroller::-webkit-scrollbar-thumb:hover': {
      backgroundColor: themeConfig.base === 'dark' ? '#5a5d5e' : '#999999'
    },
    
    // Panels (search, replace, etc.)
    '.cm-panels': {
      backgroundColor: themeConfig.base === 'dark' ? '#252526' : '#f3f3f3',
      color: foreground
    },
    
    '.cm-panels.cm-panels-top': {
      borderBottom: `1px solid ${themeConfig.base === 'dark' ? '#464647' : '#cccccc'}`
    },
    
    '.cm-panels.cm-panels-bottom': {
      borderTop: `1px solid ${themeConfig.base === 'dark' ? '#464647' : '#cccccc'}`
    },
    
    // Search panel styling
    '.cm-search': {
      padding: '4px 8px'
    },
    
    '.cm-search input, .cm-search button': {
      margin: '2px',
      padding: '2px 6px',
      fontSize: '12px',
      backgroundColor: themeConfig.base === 'dark' ? '#3c3c3c' : '#ffffff',
      color: foreground,
      border: `1px solid ${themeConfig.base === 'dark' ? '#464647' : '#cccccc'}`,
      borderRadius: '3px'
    },
    
    '.cm-search button:hover': {
      backgroundColor: themeConfig.base === 'dark' ? '#094771' : '#e1f5fe'
    },
    
    // Tooltip
    '.cm-tooltip': {
      backgroundColor: themeConfig.base === 'dark' ? '#252526' : '#f8f8f8',
      color: foreground,
      border: `1px solid ${themeConfig.base === 'dark' ? '#464647' : '#cccccc'}`,
      borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
    },
    
    // Autocomplete
    '.cm-completionLabel': {
      color: foreground
    },
    
    '.cm-completionDetail': {
      color: syntax.comment,
      fontStyle: 'italic'
    },
    
    // Diagnostics/linting
    '.cm-diagnostic-error': {
      borderBottom: `2px wavy ${syntax.error}`
    },
    
    '.cm-diagnostic-warning': {
      borderBottom: `2px wavy ${syntax.number}`
    },
    
    '.cm-diagnostic-info': {
      borderBottom: `2px dotted ${syntax.keyword}`
    }
    
  }, { dark: themeConfig.base === 'dark' });
  
  return [editorTheme, syntaxHighlighting(highlightStyle)];
}

// Get current theme configuration
export function getCurrentTheme() {
  const settings = window.settings || {};
  const themeName = settings.theme || 'dark';
  
  // Check if user has custom themes defined
  if (settings.themes && settings.themes[themeName]) {
    return { ...defaultThemes[themeName], ...settings.themes[themeName] };
  }
  
  return defaultThemes[themeName] || defaultThemes.dark;
}

// Update theme in settings
export function updateThemeSettings(themeName, themeConfig) {
  if (!window.settings) window.settings = {};
  if (!window.settings.themes) window.settings.themes = {};
  
  window.settings.themes[themeName] = themeConfig;
  
  // Save settings
  if (window.saveSettings) {
    window.saveSettings();
  }
}

// Create default theme structure for settings
export function createDefaultThemeSettings() {
  return {
    themes: {
      dark: {
        ...defaultThemes.dark
      },
      light: {
        ...defaultThemes.light
      }
    }
  };
}
