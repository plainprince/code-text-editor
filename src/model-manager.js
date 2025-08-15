import { Modal } from './modal.js';

export class ModelManager {
  constructor() {
    this.modelDropdownMenu = document.getElementById('ai-model-dropdown-menu');
    this.addModelButton = document.getElementById('ai-add-model-button');
    this.modelSearch = document.getElementById('ai-model-search');
    this.itemsContainer = document.querySelector('.dropdown-items-container');
    this.maxModeToggle = document.getElementById('ai-max-mode-toggle');
    this.models = [];
    this.maxMode = false;

    this.addModelButton.addEventListener('click', () => this.showAddModelDialog());
    if (this.modelSearch) {
      this.modelSearch.addEventListener('input', (e) => this.filterModels(e.target.value));
    }
    if (this.maxModeToggle) {
      this.maxModeToggle.addEventListener('click', () => this.toggleMaxMode());
    }
  }

  async initialize() {
    await this.fetchOllamaModels();
    this.renderModelDropdown();
  }
  
  async fetchOllamaModels() {
    try {
      const isInstalled = await this.checkOllamaInstallation();
      if (!isInstalled) {
        Modal.showCustomDialog(
          'Ollama Not Found',
          'Ollama is not installed or not in your PATH. Please install it to use local AI models. <br><br> <a href="https://ollama.ai/" target="_blank">Download Ollama</a>',
          [{ label: 'OK', value: 'ok', className: 'btn-primary' }]
        );
        return;
      }
      if (!window.__TAURI__) {
        console.warn("Tauri API not available. Skipping Ollama integration.");
        this.models = [{ id: 'mock-model', name: 'Mock Model (No Tauri)', provider: 'mock' }];
        return;
      }
      const output = await window.__TAURI__.core.invoke('run_command', {
        command: 'ollama',
        args: ['list'],
        cwd: '.'
      });
      
      const ollamaModels = this.parseOllamaOutput(output);
      this.models = ollamaModels.map(model => ({ id: model, name: model, provider: 'ollama' }));
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      Modal.alert('Ollama Error', 'Could not fetch Ollama models. Make sure Ollama is installed and running.');
    }
  }

  async checkOllamaInstallation() {
    try {
      if (!window.__TAURI__) return false;
      await window.__TAURI__.core.invoke('run_command', {
        command: 'ollama',
        args: ['--version'],
        cwd: '.'
      });
      return true; // If we get here, the command succeeded
    } catch (error) {
      return false;
    }
  }

  parseOllamaOutput(output) {
    return output.split('\n')
      .slice(1) // Skip header
      .map(line => {
        const parts = line.split(/\s+/);
        return parts[0]; // Just get the model name (first column)
      })
      .filter(modelName => modelName && modelName.trim() && !modelName.includes('embed'));
  }
  
  renderModelDropdown() {
    if (!this.itemsContainer) {
      this.itemsContainer = this.modelDropdownMenu.querySelector('.dropdown-items-container');
    }
    
    if (this.itemsContainer) {
      this.itemsContainer.innerHTML = '';
      
      this.models.forEach(model => {
        const item = document.createElement('button');
        item.className = 'dropdown-item';
        item.dataset.modelId = model.id;
        item.textContent = model.name;
        this.itemsContainer.appendChild(item);
      });
      
      // Set the first model as selected by default
      if (this.models.length > 0 && !this.selectedModel) {
        this.selectedModel = this.models[0].id;
        const button = document.getElementById('ai-model-dropdown-button');
        button.textContent = this.models[0].name;
      }
    }
  }

  filterModels(searchTerm) {
    if (!this.itemsContainer) return;
    
    const items = this.itemsContainer.querySelectorAll('.dropdown-item');
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      const matches = text.includes(searchTerm.toLowerCase());
      item.classList.toggle('hidden', !matches);
    });
  }

  toggleMaxMode() {
    this.maxMode = !this.maxMode;
    this.maxModeToggle.textContent = this.maxMode ? '🔥 Max Mode: ON' : '🔥 Max Mode: OFF';
    this.maxModeToggle.style.backgroundColor = this.maxMode ? 'var(--accent-color)' : '';
    this.maxModeToggle.style.color = this.maxMode ? 'white' : '';
  }

  async showAddModelDialog() {
    const modelName = await Modal.prompt('Add Ollama Model', 'Enter the name of the model to download (e.g., llama3):', '');
    if (modelName) {
      this.downloadModel(modelName);
    }
  }

  async downloadModel(modelName) {
    try {
      // Ensure model name has proper tag
      const fullModelName = modelName.includes(':') ? modelName : `${modelName}:latest`;
      
      // Open terminal panel
      const setBottomPanel = window.setBottomPanel;
      if (setBottomPanel) {
        setBottomPanel('terminal');
      }
      
      // Wait a bit for terminal to open
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Create new terminal session if possible
      if (window.terminal && window.terminal.createNewTerminal) {
        await window.terminal.createNewTerminal();
      }
      
      // Send the ollama pull command to the terminal
      const command = `ollama pull "${fullModelName}"`;
      
      if (window.terminal && window.terminal.writeToActiveTerminal) {
        await window.terminal.writeToActiveTerminal(command + '\r\n');
        Modal.alert('Download Started', `Started downloading ${fullModelName}. Check the terminal for progress.`);
      } else {
        // Fallback: execute directly
        Modal.alert('Download Started', `Starting download of ${fullModelName}...`);
        
        const result = await window.__TAURI__.core.invoke('run_command', {
          command: 'ollama',
          args: ['pull', fullModelName],
          cwd: '.'
        });
        
        if (result.code === 0) {
          Modal.alert('Success', `${fullModelName} downloaded successfully.`);
          // Refresh models after successful download
          await this.fetchOllamaModels();
          this.renderModelDropdown();
        } else {
          throw new Error(result.stderr || 'Download failed');
        }
      }
      
    } catch (error) {
      console.error('Error starting model download:', error);
      Modal.alert('Download Error', `Failed to start download: ${error.message}`);
    }
  }
  
  parseOllamaPullProgress(line) {
    return line;
  }
}
