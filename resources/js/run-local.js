/code+text-editor/resources/js/run-local.js
// This file is now frontend-friendly and uses Neutralino APIs.
// It exports a runScript function for use in the browser context.

import { interpret, getInitialState } from "./interpreter.js";

// Hardcoded script path for the interpreter
const SCRIPT_PATH = "resources/example.my_lang";

// Exported function for frontend use
async function runScript() {
  // Read script file using Neutralino
  let code;
  try {
    const result = await Neutralino.filesystem.readFile(SCRIPT_PATH);
    code = result.content;
  } catch (err) {
    showNotification(`File not found: ${SCRIPT_PATH}`, 'error');
    Neutralino.events.emit("interpreterStatus", { status: "error", error: `File not found: ${SCRIPT_PATH}` });
    return;
  }

  // 1. Define custom native functions
  const customFunctions = {
    set_config_value: (state, key, value) => {
      if (typeof key !== "string") {
        throw new Error("Config key must be a string");
      }
      state.config[key] = value;
      return state.config;
    },
    get_platform: () => {
      // Neutralino.os.getPlatform() returns a promise, so we return a placeholder or handle async if needed
      return Neutralino.os.getPlatform();
    },
  };

  // 2. Logging and callbacks
  const onChunk = (chunk) => {
    // For frontend, emit output via Neutralino events
    const cleanChunk = chunk.replace(/\x1b\[[0-9;]*m/g, "");
    Neutralino.events.emit("interpreterOutput", { output: cleanChunk });
  };
  const onCanvasUpdate = (command) => {
    Neutralino.events.emit("canvasUpdate", { command });
  };
  const onConsoleClear = () => {
    Neutralino.events.emit("consoleClear");
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const callbacks = {
    onChunk,
    onCanvasUpdate,
    onConsoleClear,
    wait,
    customFunctions,
  };

  // 3. Enable all features
  const settings = {
    enableFs: true,
    enableShell: true,
  };

  const state = getInitialState(callbacks, settings);

  Neutralino.events.emit("interpreterStatus", { status: "running" });
  try {
    await interpret(code, state);
    Neutralino.events.emit("interpreterStatus", { status: "finished" });
  } catch (error) {
    Neutralino.events.emit("interpreterStatus", { status: "error", error: error.toString() });
  }
}

// Export for frontend use
window.runScript = runScript;
