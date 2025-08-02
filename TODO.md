Important notice for AI agents: Read this file first. If a user's message is simply to view this file (e.g., 'See TODO.md'), it's an instruction to finish ALL open tasks listed below. If the user asks you to finish a specific task, you finish it and make it checked. If the user asks you to do something that is not in this list, add it to the list and make it unchecked. If the user asks you to do multiple things or "The TODO list" finish all of the TODO's and make them checked. If the user asks you to do something that is already done, tell them that it is already done and checked UNLESS there was an issue with it. Then make a new todo to fix the bug and finish it. If there a bugs, fix those before adding new features. Don't add new features UNLESS the user specifically asks you to do so (example: Add features from @TODO.md ).

Bugs (Note for agents: VSCode is open source, so for fixing bugs, check vscode's code):
- [x] Folders can currently not be closed once opened
- [x] TypeError: fileExplorer.selectedItems.includes is not a function. (In 'fileExplorer.selectedItems.includes(dragSrcEl.dataset.path)', 'fileExplorer.selectedItems.includes' is undefined) --- when starting to drag a file
- [x] SyntaxError: JSON Parse error: Unexpected EOF --- when dragging a file into a folder (not when cut-pasting though)
- [x] Error saving settings: Unable to write file: /Users/simeonkummer/Library/Application Support/my-code-editor/settings.tmp.json --- when opening or trying to close a folder
- [x] Files inside folders are not selectable
- [x] Cut -> Paste when having multiple files selected only moves one of both
- [x] Highlight colors should be more of a gray, not a blue.
- [✓] File and folder names showing as 'undefined' in the file explorer
- [x] Folders displayed as empty when toggled open (Fixed with comprehensive Jest tests)

Features missing:
- [ ] Terminal emulator
- [ ] Monaco-based code editor
- [ ] AI Tools:
  - [ ] AI panel with AI agent (using tools and openAI-like API's (default localhost:11434 (ollama)))
  - [ ] selectable auto-detected ollama models
  - [ ] inline agent (wrapper of agent)
  - [ ] AI tab completions
- [ ] Run button in editor
- [ ] Terminal tabs
- [ ] Faster file explorer via folder caching
- [ ] File search
- [ ] custom start scripts like in IntelliJ IDEA
- [ ] Settings menu (JSON-based)
- [ ] custom themes and languages (JSON settings file based)
- [ ] git panel
- [ ] outline panel (via LSP server)
- [ ] Project diagnostics panel (in terminal bar) (via LSP server)
- [ ] voice chat + shared files for collabs (like Jetbrains Code With Me)
- [ ] Debug panel (if possible via LSP server)
- [ ] Language features:
  - [ ] Auto-detecting .venv for run button
  - [ ] Auto-detecting .mvnw and .gradlew for run button
  - [ ] Auto-detecting package.json for run button
  - [ ] Auto-detecting Makefile for run button
  - [ ] my custom language with run button (See @interpreter.js and @run-local.js)
  - [ ] LSP server linting, formatting, highlighting and autocompletion
  - [ ] md preview
- [ ] goal:
  - [ ] Less than 100MB download size and 1 second of startup time
  - [ ] (optional) Less than 50MB download size and 0.5 seconds of startup time
  - [ ] Web version via e.g. X11 forwarding or direct browser access (as it's written with js/css/html)
