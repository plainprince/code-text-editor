export class AITools {
  static editManager = null; // Will be set by AiPanel

  static async applyPatch({ filePath, from, to, insert }) {
    if (!this.editManager) {
      return { success: false, error: 'EditManager not initialized.' };
    }
    this.editManager.addPendingEdit(filePath, from, to, insert);
    return { success: true, message: `Pending edit applied to ${filePath}` };
  }

  static async readFile({ path }) {
    try {
      const content = await window.__TAURI__.fs.readTextFile(path);
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }

  static async writeFile({ path, content }) {
    try {
      await window.__TAURI__.fs.writeTextFile(path, content);
      return { success: true, message: `Wrote to ${path}` };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }

  static async listFiles({ directory }) {
    try {
      const files = await window.__TAURI__.fs.readDir(directory, { recursive: true });
      return { success: true, files };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }

  static async runTerminalCommand({ command }) {
    try {
      const cmd = new window.__TAURI__.shell.Command('sh', ['-c', command]);
      const output = await cmd.execute();
      return { success: output.code === 0, output: output.stdout, error: output.stderr };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }
  
  static async getTodos() {
    const todoPath = await this.getTodoFilePath();
    try {
      const content = await window.__TAURI__.fs.readTextFile(todoPath);
      return { success: true, todos: content };
    } catch (error) {
      return { success: true, todos: '' };
    }
  }

  static async addTodo({ item }) {
    const todoPath = await this.getTodoFilePath();
    try {
      let content = '';
      try {
        content = await window.__TAURI__.fs.readTextFile(todoPath);
      } catch (e) {
        content = '<comment> generated with "Code Editor" - do not remove this comment to keep functionality for the TODO list of your editor. </comment>\n\n';
      }
      
      content += `\n- [ ] ${item}`;
      await window.__TAURI__.fs.writeTextFile(todoPath, content);
      return { success: true, message: 'TODO item added.' };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }
  
  static async removeTodo({ item }) {
    const todoPath = await this.getTodoFilePath();
    try {
      let content = await window.__TAURI__.fs.readTextFile(todoPath);
      const lines = content.split('\n');
      const newLines = lines.filter(line => !line.includes(item));
      const newContent = newLines.join('\n');
      
      await window.__TAURI__.fs.writeTextFile(todoPath, newContent);
      return { success: true, message: 'TODO item removed.' };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }

  static async getTodoFilePath() {
    const projectRoot = await window.__TAURI__.path.resolve('/'); 
    
    let todoPath = `${projectRoot}/TODO.md`;
    let i = 2;
    while (await window.__TAURI__.fs.exists(todoPath)) {
      const content = await window.__TAURI__.fs.readTextFile(todoPath);
      if (content.startsWith('<comment> generated with "Code Editor"')) {
        return todoPath;
      }
      todoPath = `${projectRoot}/TODO${i}.md`;
      i++;
    }
    return todoPath;
  }
}
