// git-panel.js - Git panel functionality

class GitPanel {
  constructor() {
    this.workspacePath = null;
    this.gitStatus = null;
    this.isGitRepository = false;
    this.refreshInterval = null;
    this.commitMessage = '';
    
    this.init();
  }

  init() {
    // Listen for workspace changes
    document.addEventListener('folder-opened', (event) => {
      this.setWorkspace(event.detail.path);
    });

    // Initialize UI
    this.setupUI();
    
    // Start auto-refresh when panel is visible
    this.startAutoRefresh();
  }

  setWorkspace(path) {
    this.workspacePath = path;
    this.checkGitRepository();
  }

  async checkGitRepository() {
    if (!this.workspacePath) {
      this.isGitRepository = false;
      this.renderContent();
      return;
    }

    try {
      this.isGitRepository = await window.__TAURI__.core.invoke('git_is_repository', { 
        path: this.workspacePath 
      });
      
      if (this.isGitRepository) {
        await this.refreshStatus();
      } else {
        this.gitStatus = null;
        this.renderContent();
      }
    } catch (error) {
      console.error('Error checking git repository:', error);
      this.isGitRepository = false;
      this.renderContent();
    }
  }

  async refreshStatus() {
    if (!this.workspacePath || !this.isGitRepository) {
      return;
    }

    try {
      this.gitStatus = await window.__TAURI__.core.invoke('git_status', { 
        path: this.workspacePath 
      });
      this.renderContent();
    } catch (error) {
      console.error('Error getting git status:', error);
      this.gitStatus = null;
      this.renderContent();
    }
  }

  setupUI() {
    const panel = document.querySelector('#git-panel .sidebar-panel-content');
    if (!panel) return;

    // Create the basic structure
    panel.innerHTML = `
      <div class="git-panel-container">
        <div class="git-panel-content">
          <!-- Content will be rendered here -->
        </div>
      </div>
    `;

    this.renderContent();
  }

  renderContent() {
    const container = document.querySelector('#git-panel .git-panel-content');
    if (!container) return;

    if (!this.workspacePath) {
      container.innerHTML = `
        <div class="git-panel-empty">
          <p>No workspace opened</p>
        </div>
      `;
      return;
    }

    if (!this.isGitRepository) {
      container.innerHTML = `
        <div class="git-panel-empty">
          <p>Not a git repository</p>
          <button class="btn btn-primary git-init-btn" onclick="gitPanel.initRepository()">
            Initialize Repository
          </button>
        </div>
      `;
      return;
    }

    if (!this.gitStatus) {
      container.innerHTML = `
        <div class="git-panel-loading">
          <p>Loading git status...</p>
        </div>
      `;
      return;
    }

    // Render git status
    const { files, branch, ahead, behind, is_clean } = this.gitStatus;
    
    // Group files by staged/unstaged
    const stagedFiles = files.filter(f => f.staged);
    const unstagedFiles = files.filter(f => !f.staged);

    container.innerHTML = `
      <div class="git-status-header">
        <div class="git-branch">
          <span class="git-branch-icon">🌿</span>
          <span class="git-branch-name">${branch || 'No branch'}</span>
          ${ahead > 0 ? `<span class="git-ahead">↑${ahead}</span>` : ''}
          ${behind > 0 ? `<span class="git-behind">↓${behind}</span>` : ''}
        </div>
        <button class="btn btn-sm git-refresh-btn" onclick="gitPanel.refreshStatus()">
          <span class="refresh-icon">🔄</span>
        </button>
      </div>

      ${this.renderCommitSection(stagedFiles)}
      ${this.renderChangesSection(stagedFiles, 'Staged Changes', true)}
      ${this.renderChangesSection(unstagedFiles, 'Changes', false)}
      
      ${is_clean ? '<div class="git-clean"><p>Working tree clean</p></div>' : ''}
    `;

    this.attachEventListeners();
  }

  renderCommitSection(stagedFiles) {
    if (stagedFiles.length === 0) {
      return '';
    }

    return `
      <div class="git-commit-section">
        <div class="git-section-header">
          <span class="git-section-title">Commit</span>
        </div>
        <div class="git-commit-input-container">
          <textarea 
            class="git-commit-input" 
            placeholder="Commit message..."
            rows="3"
            onkeydown="gitPanel.handleCommitInputKeydown(event)"
            oninput="gitPanel.updateCommitMessage(event)"
          >${this.commitMessage}</textarea>
          <div class="git-commit-actions">
            <button 
              class="btn btn-primary git-commit-btn" 
              onclick="gitPanel.commit()"
              ${!this.commitMessage.trim() ? 'disabled' : ''}
            >
              Commit (${stagedFiles.length})
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderChangesSection(files, title, isStaged) {
    if (files.length === 0) {
      return '';
    }

    const actionIcon = isStaged ? '−' : '+';
    const actionTitle = isStaged ? 'Unstage' : 'Stage';

    return `
      <div class="git-changes-section">
        <div class="git-section-header" onclick="gitPanel.toggleSection('${isStaged ? 'staged' : 'unstaged'}')">
          <span class="git-section-arrow ${isStaged ? 'expanded' : 'expanded'}">▼</span>
          <span class="git-section-title">${title} (${files.length})</span>
          <div class="git-section-actions">
            <button 
              class="btn btn-sm git-stage-all-btn" 
              onclick="gitPanel.${isStaged ? 'unstageAll' : 'stageAll'}(event)"
              title="${isStaged ? 'Unstage All' : 'Stage All'}"
            >
              ${actionIcon}
            </button>
          </div>
        </div>
        <div class="git-file-list" data-section="${isStaged ? 'staged' : 'unstaged'}">
          ${files.map(file => this.renderFileItem(file)).join('')}
        </div>
      </div>
    `;
  }

  renderFileItem(file) {
    const statusIcon = this.getStatusIcon(file.status);
    const statusClass = this.getStatusClass(file.status);
    const actionIcon = file.staged ? '−' : '+';
    const actionTitle = file.staged ? 'Unstage' : 'Stage';

    return `
      <div class="git-file-item ${statusClass}">
        <div class="git-file-content" onclick="gitPanel.openFile('${file.path}')">
          <span class="git-file-status">${statusIcon}</span>
          <span class="git-file-name" title="${file.path}">${this.getFileName(file.path)}</span>
          <span class="git-file-path">${this.getFilePath(file.path)}</span>
        </div>
        <div class="git-file-actions">
          <button 
            class="btn btn-sm git-stage-file-btn" 
            onclick="gitPanel.${file.staged ? 'unstageFile' : 'stageFile'}('${file.path}', event)"
            title="${actionTitle}"
          >
            ${actionIcon}
          </button>
        </div>
      </div>
    `;
  }

  getStatusIcon(status) {
    const icons = {
      'M': '●', // Modified
      'A': '+', // Added
      'D': '×', // Deleted
      'R': '→', // Renamed
      'C': '©', // Copied
      'U': '!', // Unmerged
      '?': '?', // Untracked
    };
    return icons[status] || status;
  }

  getStatusClass(status) {
    const classes = {
      'M': 'modified',
      'A': 'added',
      'D': 'deleted',
      'R': 'renamed',
      'C': 'copied',
      'U': 'unmerged',
      '?': 'untracked',
    };
    return classes[status] || 'unknown';
  }

  getFileName(path) {
    return path.split('/').pop();
  }

  getFilePath(path) {
    const parts = path.split('/');
    if (parts.length <= 1) return '';
    return parts.slice(0, -1).join('/');
  }

  attachEventListeners() {
    // Event listeners are attached via onclick attributes in the HTML
  }

  // Event handlers
  updateCommitMessage(event) {
    this.commitMessage = event.target.value;
    
    // Enable/disable commit button
    const commitBtn = document.querySelector('.git-commit-btn');
    if (commitBtn) {
      commitBtn.disabled = !this.commitMessage.trim();
    }
  }

  handleCommitInputKeydown(event) {
    // Ctrl/Cmd + Enter to commit
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.commit();
    }
  }

  toggleSection(section) {
    const sectionElement = document.querySelector(`[data-section="${section}"]`);
    const arrow = document.querySelector(`[data-section="${section}"]`)?.previousElementSibling?.querySelector('.git-section-arrow');
    
    if (sectionElement && arrow) {
      const isExpanded = arrow.classList.contains('expanded');
      arrow.classList.toggle('expanded', !isExpanded);
      sectionElement.style.display = isExpanded ? 'none' : 'block';
    }
  }

  // Git operations
  async initRepository() {
    if (!this.workspacePath) {
      this.showNotification('No workspace opened', 'error');
      return;
    }

    try {
      await window.__TAURI__.core.invoke('git_init', { path: this.workspacePath });
      this.showNotification('Git repository initialized', 'success');
      await this.checkGitRepository();
    } catch (error) {
      console.error('Error initializing git repository:', error);
      this.showNotification('Failed to initialize git repository: ' + error, 'error');
    }
  }

  async stageFile(filePath, event) {
    event?.stopPropagation();
    
    if (!this.workspacePath) return;

    try {
      await window.__TAURI__.core.invoke('git_add', { 
        path: this.workspacePath, 
        filePath 
      });
      await this.refreshStatus();
    } catch (error) {
      console.error('Error staging file:', error);
      this.showNotification('Failed to stage file: ' + error, 'error');
    }
  }

  async unstageFile(filePath, event) {
    event?.stopPropagation();
    
    if (!this.workspacePath) return;

    try {
      await window.__TAURI__.core.invoke('git_reset', { 
        path: this.workspacePath, 
        filePath 
      });
      await this.refreshStatus();
    } catch (error) {
      console.error('Error unstaging file:', error);
      this.showNotification('Failed to unstage file: ' + error, 'error');
    }
  }

  async stageAll(event) {
    event?.stopPropagation();
    
    if (!this.gitStatus) return;

    const unstagedFiles = this.gitStatus.files.filter(f => !f.staged);
    
    try {
      for (const file of unstagedFiles) {
        await window.__TAURI__.core.invoke('git_add', { 
          path: this.workspacePath, 
          filePath: file.path 
        });
      }
      await this.refreshStatus();
    } catch (error) {
      console.error('Error staging all files:', error);
      this.showNotification('Failed to stage all files: ' + error, 'error');
    }
  }

  async unstageAll(event) {
    event?.stopPropagation();
    
    if (!this.gitStatus) return;

    const stagedFiles = this.gitStatus.files.filter(f => f.staged);
    
    try {
      for (const file of stagedFiles) {
        await window.__TAURI__.core.invoke('git_reset', { 
          path: this.workspacePath, 
          filePath: file.path 
        });
      }
      await this.refreshStatus();
    } catch (error) {
      console.error('Error unstaging all files:', error);
      this.showNotification('Failed to unstage all files: ' + error, 'error');
    }
  }

  async commit() {
    if (!this.commitMessage.trim()) {
      this.showNotification('Commit message is required', 'error');
      return;
    }

    if (!this.workspacePath) return;

    try {
      const result = await window.__TAURI__.core.invoke('git_commit', { 
        path: this.workspacePath, 
        message: this.commitMessage 
      });
      
      this.commitMessage = '';
      this.showNotification('Committed successfully', 'success');
      await this.refreshStatus();
    } catch (error) {
      console.error('Error committing:', error);
      this.showNotification('Failed to commit: ' + error, 'error');
    }
  }

  async openFile(filePath) {
    // Use the file explorer to open the file
    if (window.fileExplorer) {
      const fullPath = this.workspacePath + '/' + filePath;
      try {
        await window.fileExplorer.openFileByPath(fullPath);
      } catch (error) {
        console.error('Error opening file:', error);
        this.showNotification('Failed to open file: ' + error, 'error');
      }
    }
  }

  // Auto-refresh
  startAutoRefresh() {
    // Refresh every 5 seconds when git panel is visible
    this.refreshInterval = setInterval(() => {
      const gitPanel = document.getElementById('git-panel');
      if (gitPanel && gitPanel.style.display !== 'none' && this.isGitRepository) {
        this.refreshStatus();
      }
    }, 5000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  showNotification(message, type = 'info') {
    // Use the existing notification system
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // Public API
  refresh() {
    return this.refreshStatus();
  }

  destroy() {
    this.stopAutoRefresh();
  }
}

// Create and export global instance
window.GitPanel = GitPanel;
export default GitPanel;
