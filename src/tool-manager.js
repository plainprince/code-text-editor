import { Modal } from './modal.js';

export class ToolManager {
  constructor() {
    this.tools = {
      'readFile': { description: 'Read a file from the workspace' },
      'writeFile': { description: 'Write content to a file in the workspace' },
      'listFiles': { description: 'List files in a directory' },
      'runTerminalCommand': { description: 'Execute a command in the terminal' },
      'applyPatch': { description: 'Apply a patch to a file' },
      'getTodos': { description: 'Get the list of TODO items' },
      'addTodo': { description: 'Add an item to the TODO list' },
      'removeTodo': { description: 'Remove an item from the TODO list' },
    };
    this.modes = {
      'agent': {
        name: 'Agent',
        description: 'All tools are allowed, including terminal commands.',
        allowedTools: Object.keys(this.tools)
      },
      'ask': {
        name: 'Ask',
        description: 'No tools allowed, only file reading for context.',
        allowedTools: ['readFile', 'listFiles']
      }
    };

    this.modeDropdownMenu = document.getElementById('ai-mode-dropdown-menu');
    this.addModeButton = document.getElementById('ai-add-mode-button');
    this.addModeButton.addEventListener('click', () => this.showAddModeDialog());
  }
  
  initialize() {
    this.renderModeDropdown();
  }

  renderModeDropdown() {
    const items = this.modeDropdownMenu.querySelectorAll('.dropdown-item:not(#ai-add-mode-button)');
    const dividers = this.modeDropdownMenu.querySelectorAll('.dropdown-divider');
    items.forEach(item => item.remove());
    dividers.forEach(divider => divider.remove());

    for (const modeKey in this.modes) {
      const mode = this.modes[modeKey];
      const item = document.createElement('button');
      item.className = 'dropdown-item';
      item.dataset.mode = modeKey;
      item.textContent = mode.name;
      this.modeDropdownMenu.insertBefore(item, this.addModeButton.previousElementSibling);
    }
    
    if (Object.keys(this.modes).length > 0) {
      const divider = document.createElement('div');
      divider.className = 'dropdown-divider';
      this.modeDropdownMenu.insertBefore(divider, this.addModeButton);
      
      // Set the first mode as selected by default
      if (!this.selectedMode) {
        const firstModeKey = Object.keys(this.modes)[0];
        this.selectedMode = firstModeKey;
        const button = document.getElementById('ai-mode-dropdown-button');
        button.textContent = this.modes[firstModeKey].name;
      }
    }
  }

  async showAddModeDialog() {
    const toolCheckboxes = Object.entries(this.tools).map(([key, { description }]) => `
      <label>
        <input type="checkbox" name="tools" value="${key}">
        <strong>${key}</strong>: ${description}
      </label>
    `).join('<br>');

    const content = `
      <div>
        <label for="mode-name">Mode Name:</label>
        <input type="text" name="modeName" class="modal-input" placeholder="e.g., Coder Mode" style="width: 100%; padding: 8px; margin-top: 5px;">
      </div>
      <div style="margin-top: 10px;">
        <label for="mode-description">Description:</label>
        <textarea name="modeDesc" class="modal-textarea" placeholder="A short description of the mode" style="width: 100%; padding: 8px; margin-top: 5px; min-height: 60px;"></textarea>
      </div>
      <div style="margin-top: 10px;">
        <strong>Allowed Tools:</strong><br>
        <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); padding: 10px; margin-top: 5px;">
          ${toolCheckboxes}
        </div>
      </div>
    `;

    const result = await Modal.showCustomDialog(
      'Create New Mode',
      content,
      [
        { label: 'Cancel', value: 'cancel', className: 'btn-secondary' },
        { label: 'Create', value: 'create', className: 'btn-primary' }
      ]
    );

    if (result.button === 'create') {
      const modeName = result.formData.modeName || '';
      const modeDesc = result.formData.modeDesc || 'Custom mode';
      const selectedTools = result.formData.tools || [];
      
      if (modeName && selectedTools.length > 0) {
        const modeKey = modeName.toLowerCase().replace(/\s+/g, '_');
        this.modes[modeKey] = {
          name: modeName,
          description: modeDesc,
          allowedTools: selectedTools
        };
        this.renderModeDropdown();
      } else {
        Modal.alert('Error', 'Please enter a mode name and select at least one tool.');
      }
    }
  }
}
