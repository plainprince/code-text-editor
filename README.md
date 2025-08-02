# Code Editor

A lightweight code editor built with Tauri and vanilla JavaScript.

## Features

- File explorer with project navigation
- Basic text editor with syntax highlighting
- Multiple tabs for open files
- Git integration (coming soon)
- Terminal integration
- Customizable settings via JSON
- Statusbar with panel toggles
- Command palette (Ctrl/Cmd+P)
- Settings editor (Ctrl/Cmd+,)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Setup

1. Clone the repository
2. Install dependencies:
   ```
   bun install
   ```
3. Run the development server:
   ```
   bun run tauri dev
   ```

### Building

To build the application:

```
bun run tauri build
```

## Customization

The editor can be customized via the settings.json file, which can be accessed by pressing Ctrl/Cmd+, within the editor.

## License

MIT