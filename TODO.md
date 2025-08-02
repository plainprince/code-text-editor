# Code Editor TODO List

## Core Features
- [x] Basic Tauri setup
- [x] Window configuration
- [x] Main layout structure
- [ ] File explorer functionality
- [ ] Code editor component (CodeMirror)
- [ ] Statusbar implementation
- [ ] Left sidebar panels
- [ ] Right sidebar panels
- [ ] Settings system (JSON-based)

## Sidebar Panels
- [ ] Project panel (file explorer)
- [ ] Git panel (version control)
- [ ] Outline panel (code structure)
- [ ] Todo panel (task list)
- [ ] Collab panel (voice chat & shared files)

## Editor Features
- [ ] Syntax highlighting
- [ ] Multiple tabs
- [ ] File operations (create, edit, delete)
- [ ] Terminal integration

## Advanced Features
- [ ] Language Server Protocol (LSP) integration
- [ ] Git integration
- [ ] Settings editor (Ctrl/Cmd+,)
- [ ] Customizable icons via settings
- [ ] Theme support

## UI Improvements
- [ ] Responsive layout
- [ ] Drag and drop support
- [ ] Context menus
- [ ] Keyboard shortcuts




## miscellaneous
- [ ] Run button for running python, js, ... files
- [ ] Auto detecting .venv, Makefile etc. for run button
- [ ] Custom start scripts like with IntelliJ IDEA
- [ ] Command pallete (Shortcut: cmd/ctrl + shift + p)
- [ ] Global file search as pane
- [ ] Symbol search (from outline panel)
- [ ] Find in folder when right clicking a folder
- [ ] Open editors list (ctrl/cmd + p)
- [ ] Integrated debugger (via lsp and monaco and DAP)
- [ ] Project insights panel (at bottom like terminal) (like zed)
- [ ] Autocompletion with custom Snippets from json settings file
- [ ] Hover Tooltips / Docs like vscode
- [ ] Quick Fix like vscode
- [ ] Inline Errors & Warnings (Diagnostics via lsp)
- [ ] Go to Definition / Implementation / References (pretty much outline panel but project-wide)
- [ ] zen mode like vscode
- [ ] Inline Git Diffs
- [ ] (optional but cool): Split View
- [ ] Minimap (from Monaco)
- [ ] Scroll Marker (show errors/warnings via lsp and monaco)
- [ ] TODO-extractor from // TODO: ... and # TODO:... and //TODO:... and #TODO:... etc. for todo pane
- [ ] Extension-API for Custom Panels/Tools
- [ ] Keybind-editor (with settings file - everything is in the settings file)
- [ ] if another json file is created in the path of the settings file, override the default settings file with the contents (To modify settings without a huge settings file)
- [ ] Live collaboration with voice chat, files and terminal (Like JetBrains Code With Me)
- [ ] AI agent panel (default ollama provider, any openai-like api)
- [ ] Generate tests in the AI panel (AI panel has an agent and in the top a toolbar with all AI actions)
- [ ] Filesystem limits etc. for AI agents
- [ ] Recovery system (store open folders, editors etc. in the settings json file)
- [ ] Integrated API tester (like hopscotch.io or postman light)
- [ ] Build-Pipeline panel (e.g. github actions left sidebar panel)
- [ ] Clipboard history (in statusbar)
- [ ] Quick insert (emojis, UTF-8 etc.) (in statusbar)
- [ ] vim mode
- [ ] Add folder to workspace
- [ ] Store workspace in json file
- [ ] fast project-wide search by caching the workspace as binary file in settings json file parent folder








See @TODO-aipanel.md for ai panel todo's