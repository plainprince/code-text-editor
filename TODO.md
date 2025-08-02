Important notice for AI agents: Read this file first. If a user's message is simply to view this file (e.g., 'See TODO.md'), it's an instruction to finish ALL open tasks listed below. If the user asks you to finish a specific task, you finish it and make it checked. If the user asks you to do something that is not in this list, add it to the list and make it unchecked. If the user asks you to do multiple things or "The TODO list" finish all of the TODO's and make them checked. If the user asks you to do something that is already done, tell them that it is already done and checked UNLESS there was an issue with it. Then make a new todo to fix the bug and finish it. If there a bugs, fix those before adding new features. Don't add new features UNLESS the user specifically asks you to do so (example: Add features from @TODO.md ).

Bugs:
- [ ] Error saving settings: Unable to write file: /Users/simeonkummer/Library/Application Support/my-code-editor/settings.json --- when adding a folder to workspace
- [ ] Project pane closes when adding a folder to workspace
- [ ] ReferenceError: Can't find variable: e --- when clicking a file or folder
- [ ] Folders not openeable because of the above error
- [ ] Some commands like moving or renaming the selected file not in command pallete
- [ ] Files not selectable
- [ ] App not opening previously opened folder/workspace when closing and opening the app again
- [ ] No "Coming soon" message for left sidebar when clicking on a button to open something else other than the project pane
- [ ] Right side of the statusbar on the left (when changing ID's styles weren't changed) - same problems with pointer cursor
- [ ] Pressing the open ai panel button in statusbar doesn't open a right side panel with a coming soon message (Note: make functionality the same as left sidebar with a variable storing the currently open panel etc.)

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
