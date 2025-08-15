import { Modal } from './modal.js';
import { ChatManager } from './chat-manager.js';
import { ToolManager } from './tool-manager.js';
import { ModelManager } from './model-manager.js';
import { AITools } from './ai-tools.js';
import { EditManager } from './edit-manager.js';

export class AiPanel {
  constructor(panelId) {
    this.panel = document.getElementById(panelId);
    if (!this.panel) {
      throw new Error(`AI panel with id "${panelId}" not found.`);
    }

    this.input = document.getElementById('ai-input');
    this.sendButton = document.getElementById('ai-send-button');
    this.contextButton = document.getElementById('ai-context-button');
    this.modelDropdownContainer = document.getElementById('ai-model-dropdown-container');
    this.modeDropdownContainer = document.getElementById('ai-mode-dropdown-container');
    this.contextMenu = document.getElementById('ai-context-menu');
    this.contextFileSearch = document.getElementById('ai-context-file-search');
    this.contextFileList = document.getElementById('ai-context-file-list');
    
    this.modelManager = new ModelManager();
    this.modelManager.initialize();

    this.toolManager = new ToolManager();
    this.toolManager.initialize();

    this.chatManager = new ChatManager('ai-chat-history', this);
    window.snapshotManager = null; // To be set from main.js

    const editorView = window.editor; 
    this.editManager = new EditManager(editorView);
    AITools.editManager = this.editManager;

    this.panel.addEventListener('click', this.handlePanelClick.bind(this));
    this.input.addEventListener('input', this.handleInput.bind(this));
    this.setupDropdowns();
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.contextButton.addEventListener('click', () => this.openContextMenu());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  setupDropdowns() {
    const dropdowns = [this.modelDropdownContainer, this.modeDropdownContainer];
    dropdowns.forEach(container => {
      const button = container.querySelector('.dropdown-toggle');
      const menu = container.querySelector('.dropdown-menu');
      
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const isAlreadyOpen = container.classList.contains('open');
        this.closeAllDropdowns();
        if (!isAlreadyOpen) {
          container.classList.add('open');
        }
      });
      
      menu.addEventListener('click', (e) => {
        if (e.target.classList.contains('dropdown-item')) {
          const button = container.querySelector('.dropdown-toggle');
          
          // Update button text to show selection
          if (e.target.dataset.modelId) {
            button.textContent = e.target.textContent;
            this.modelManager.selectedModel = e.target.dataset.modelId;
          } else if (e.target.dataset.mode) {
            button.textContent = e.target.textContent;
            this.toolManager.selectedMode = e.target.dataset.mode;
          }
          
          this.closeAllDropdowns();
        }
      });
    });
    
    document.addEventListener('click', () => this.closeAllDropdowns());
  }

  closeAllDropdowns() {
    [this.modelDropdownContainer, this.modeDropdownContainer].forEach(container => {
      container.classList.remove('open');
    });
  }

  handleInput(e) {
    const text = e.target.value;
    const lastChar = text[text.length - 1];

    if (lastChar === '@') {
      this.openContextMenu();
    } else {
      this.closeContextMenu();
    }
  }

  openContextMenu() {
    this.contextMenu.classList.remove('hidden');
    this.contextFileSearch.focus();
    this.populateFileList();
  }

  async populateFileList() {
    try {
      // Use the same approach as the file explorer
      if (window.fileExplorer && window.fileExplorer.rootFolder) {
        const files = await window.__TAURI__.core.invoke('get_workspace_files', { 
          workspace_path: window.fileExplorer.rootFolder 
        });
        this.contextFileList.innerHTML = '';
        
        files.slice(0, 10).forEach(file => { // Show first 10 files
          const li = document.createElement('li');
          li.textContent = file.name || file;
          li.addEventListener('click', () => {
            this.addFileToInput(file.name || file);
          });
          this.contextFileList.appendChild(li);
        });
      } else {
        this.contextFileList.innerHTML = '<li>Open a project first</li>';
      }
    } catch (error) {
      console.error('Error loading files:', error);
      this.contextFileList.innerHTML = '<li>src/main.js</li><li>src/styles.css</li><li>package.json</li>';
    }
  }

  addFileToInput(fileName) {
    const currentValue = this.input.value;
    const atIndex = currentValue.lastIndexOf('@');
    const newValue = currentValue.substring(0, atIndex) + `@${fileName} `;
    this.input.value = newValue;
    this.input.focus();
    this.closeContextMenu();
  }

  closeContextMenu() {
    this.contextMenu.classList.add('hidden');
  }

  async handlePanelClick(e) {
    const link = e.target.closest('a');
    if (!link || !link.href) return;

    e.preventDefault();
    const url = link.href;

    const choice = await Modal.showCustomDialog(
      'External Link',
      `You are about to open: <br><strong>${url}</strong>`,
      [
        { label: 'Cancel', value: 'cancel', className: 'btn-secondary' },
        { label: 'Copy URL', value: 'copy', className: 'btn-secondary' },
        { label: 'Open Link', value: 'open', className: 'btn-primary' }
      ]
    );

    if (choice === 'open') {
      try {
        await window.__TAURI__.shell.open(url);
      } catch (err) {
        console.error('Failed to open URL:', err);
        Modal.alert('Error', 'Could not open the link in an external browser.');
      }
    } else if (choice === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
      } catch (err) {
        console.error('Failed to copy URL:', err);
        Modal.alert('Error', 'Could not copy the URL to the clipboard.');
      }
    }
  }

  clear() {
    this.panel.innerHTML = '';
  }

  sendMessage() {
    const content = this.input.value;
    this.chatManager.sendMessage(content);
    this.input.value = '';
    this.input.focus();
  }
}