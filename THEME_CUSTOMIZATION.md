# CodeMirror Theme Customization Guide

This editor now uses CodeMirror 6 with a fully customizable theme system. You can modify colors, keywords, and syntax highlighting through the settings.json file.

## Theme Structure

Each theme in your settings.json has the following structure:

```json
{
  "themes": {
    "dark": {
      "name": "Dark Theme",
      "base": "dark",
      "background": "#1e1e1e",
      "foreground": "#d4d4d4",
      "caret": "#ffffff",
      "selection": "#264f78",
      "selectionMatch": "#094771",
      "lineHighlight": "#2a2d2e",
      "gutterBackground": "#1e1e1e",
      "gutterForeground": "#858585",
      
      "syntax": {
        "keyword": "#569cd6",
        "string": "#ce9178",
        "comment": "#6a9955",
        "number": "#b5cea8",
        "operator": "#d4d4d4",
        "punctuation": "#d4d4d4",
        "variable": "#9cdcfe",
        "function": "#dcdcaa",
        "type": "#4ec9b0",
        "tag": "#569cd6",
        "attribute": "#92c5f8",
        "property": "#9cdcfe",
        "constant": "#4fc1ff",
        "error": "#f44747"
      },
      
      "customKeywords": {
        "jsKeywords": ["const", "let", "var", "function", "class"],
        "jsBuiltins": ["console", "window", "document"],
        "pythonKeywords": ["def", "class", "import", "from"],
        "pythonBuiltins": ["print", "len", "range"],
        "rustKeywords": ["fn", "struct", "enum", "impl"],
        "rustBuiltins": ["Vec", "HashMap", "Option"],
        "controlFlow": ["if", "else", "for", "while"],
        "types": ["int", "float", "string", "bool"]
      }
    }
  }
}
```

## Customization Options

### Basic Colors
- `background`: Main editor background
- `foreground`: Main text color
- `caret`: Cursor color
- `selection`: Selected text background
- `selectionMatch`: Search match highlight
- `lineHighlight`: Current line highlight
- `gutterBackground`: Line number area background
- `gutterForeground`: Line number color

### Syntax Highlighting
- `keyword`: Language keywords (if, function, class, etc.)
- `string`: String literals
- `comment`: Comments
- `number`: Numeric literals
- `operator`: Operators (+, -, *, etc.)
- `punctuation`: Brackets, semicolons, etc.
- `variable`: Variable names
- `function`: Function names
- `type`: Type names
- `tag`: HTML/XML tags
- `attribute`: HTML/XML attributes
- `property`: Object properties
- `constant`: Constants and built-in values
- `error`: Error highlighting

### Custom Keywords
You can define custom keyword lists for different programming languages:

- `jsKeywords`: JavaScript/TypeScript keywords
- `jsBuiltins`: JavaScript built-in objects/functions
- `pythonKeywords`: Python keywords
- `pythonBuiltins`: Python built-in functions
- `rustKeywords`: Rust keywords
- `rustBuiltins`: Rust standard library types
- `goKeywords`: Go keywords
- `goBuiltins`: Go standard library packages
- `controlFlow`: Control flow keywords (if, else, for, etc.)
- `types`: Basic type names

## Creating Custom Themes

### Example: Purple Theme
```json
{
  "themes": {
    "purple": {
      "name": "Purple Theme",
      "base": "dark",
      "background": "#2d1b47",
      "foreground": "#e6d6ff",
      "caret": "#bb86fc",
      "selection": "#6200ea",
      "selectionMatch": "#7c4dff",
      "lineHighlight": "#3c2963",
      "gutterBackground": "#2d1b47",
      "gutterForeground": "#9575cd",
      
      "syntax": {
        "keyword": "#bb86fc",
        "string": "#69f0ae",
        "comment": "#9e9e9e",
        "number": "#ff8a65",
        "operator": "#e6d6ff",
        "punctuation": "#e6d6ff",
        "variable": "#81d4fa",
        "function": "#ffab40",
        "type": "#ab47bc",
        "tag": "#bb86fc",
        "attribute": "#81d4fa",
        "property": "#81d4fa",
        "constant": "#ff5722",
        "error": "#f44336"
      },
      
      "customKeywords": {
        "jsKeywords": ["const", "let", "var", "function", "class", "async", "await"],
        "jsBuiltins": ["console", "window", "document", "fetch", "Promise"],
        "controlFlow": ["if", "else", "for", "while", "switch", "case"],
        "types": ["string", "number", "boolean", "object", "array"]
      }
    }
  }
}
```

### Example: Adding Custom Keywords
You can extend the keyword lists to include framework-specific or domain-specific terms:

```json
{
  "customKeywords": {
    "reactKeywords": ["useState", "useEffect", "useContext", "useReducer"],
    "vueKeywords": ["ref", "reactive", "computed", "watch"],
    "sqlKeywords": ["SELECT", "FROM", "WHERE", "JOIN", "GROUP BY"],
    "htmlTags": ["div", "span", "header", "main", "section", "article"]
  }
}
```

## How to Apply Themes

1. Open Settings (Ctrl/Cmd + ,)
2. Modify the `themes` object in your settings.json
3. Change the `theme` property to use your custom theme name
4. Save the settings file
5. The theme will automatically apply

## Supported Languages

The editor supports syntax highlighting for:
- JavaScript/TypeScript (.js, .jsx, .ts, .tsx)
- HTML (.html, .htm)
- CSS/SCSS/Less (.css, .scss, .sass, .less)
- JSON (.json)
- Markdown (.md, .markdown)
- Python (.py)
- Rust (.rs)
- Go (.go)
- C/C++ (.c, .cpp, .h, .hpp)
- Java (.java)
- PHP (.php)

## Tips

- Use hex colors for best compatibility (#ffffff, #000000)
- The `base` property should be either "dark" or "light"
- Test your themes with different file types
- Colors should have good contrast for readability
- Save your custom themes in the settings.json for persistence
