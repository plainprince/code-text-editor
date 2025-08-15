import { Modal } from './modal.js';

export class ModelManager {
  constructor() {
    this.modelDropdownMenu = document.getElementById('ai-model-dropdown-menu');
    this.addModelButton = document.getElementById('ai-add-model-button');
    this.models = [];

    this.addModelButton.addEventListener('click', () => this.showAddModelDialog());
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
      .map(line => line.split(/\\s+/)[0])
      .filter(modelName => modelName && !modelName.includes('embed'));
  }
  
  renderModelDropdown() {
    const items = this.modelDropdownMenu.querySelectorAll('.dropdown-item:not(#ai-add-model-button)');
    const dividers = this.modelDropdownMenu.querySelectorAll('.dropdown-divider');
    items.forEach(item => item.remove());
    dividers.forEach(divider => divider.remove());
    
    this.models.forEach(model => {
      const item = document.createElement('button');
      item.className = 'dropdown-item';
      item.dataset.modelId = model.id;
      item.textContent = model.name;
      this.modelDropdownMenu.insertBefore(item, this.addModelButton.previousElementSibling);
    });
    
    if (this.models.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'dropdown-divider';
      this.modelDropdownMenu.insertBefore(divider, this.addModelButton);
      
      // Set the first model as selected by default
      if (!this.selectedModel) {
        this.selectedModel = this.models[0].id;
        const button = document.getElementById('ai-model-dropdown-button');
        button.textContent = this.models[0].name;
      }
    }
  }

  async showAddModelDialog() {
    const modelName = await Modal.prompt('Add Ollama Model', 'Enter the name of the model to download (e.g., llama3):', '');
    if (modelName) {
      this.downloadModel(modelName);
    }
  }

  async downloadModel(modelName) {
    const progressModal = new Modal('download-progress', {
      title: `Downloading ${modelName}`,
      content: '<div class="progress-bar-container"><div class="progress-bar"></div></div><div class="progress-text">Starting...</div>',
      draggable: true,
      canClose: false,
    });
    progressModal.show();

    try {
      const output = await window.__TAURI__.core.invoke('run_command', {
        command: 'ollama',
        args: ['pull', modelName],
        cwd: '.'
      });
      
      progressModal.close();
      Modal.alert('Success', `${modelName} downloaded successfully.`);
      await this.fetchOllamaModels();
      this.renderModelDropdown();
    } catch (error) {
      progressModal.close();
      console.error('Error downloading model:', error);
      Modal.alert('Error', 'An error occurred while trying to download the model.');
    }
  }
  
  parseOllamaPullProgress(line) {
    return line;
  }
}
