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
      'ask': {
        name: 'Ask',
        description: 'No tools allowed, only file reading for context.',
        allowedTools: ['readFile', 'listFiles']
      },
      'agent': {
        name: 'Agent',
        description: 'All tools are allowed, including terminal commands.',
        allowedTools: Object.keys(this.tools)
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
        <input type="text" id="new-mode-name" class="modal-input" placeholder="e.g., Coder Mode">
      </div>
      <div style="margin-top: 10px;">
        <label for="mode-description">Description:</label>
        <textarea id="new-mode-desc" class="modal-textarea" placeholder="A short description of the mode"></textarea>
      </div>
      <div style="margin-top: 10px;">
        <strong>Allowed Tools:</strong><br>
        ${toolCheckboxes}
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

    if (result === 'create') {
      const name = document.getElementById('new-mode-name').value;
      const description = document.getElementById('new-mode-desc').value;
      const selectedTools = Array.from(document.querySelectorAll('input[name="tools"]:checked')).map(cb => cb.value);
      
      if (name && description && selectedTools.length > 0) {
        const key = name.toLowerCase().replace(/\s+/g, '-');
        this.modes[key] = { name, description, allowedTools: selectedTools };
        this.renderModeDropdown();
      } else {
        Modal.alert('Error', 'Please fill out all fields and select at least one tool.');
      }
    }
  }
}
