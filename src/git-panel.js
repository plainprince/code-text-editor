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
          <span class="git-branch-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.5 3A1.5 1.5 0 003 4.5v7A1.5 1.5 0 004.5 13h7a1.5 1.5 0 001.5-1.5V8.5L10 6 8.5 7.5 4.5 3z"/>
              <path d="M6 3l6 6v4.5A1.5 1.5 0 0110.5 15h-7A1.5 1.5 0 012 13.5v-7A1.5 1.5 0 013.5 5H6V3z"/>
            </svg>
          </span>
          <span class="git-branch-name">${branch || 'No branch'}</span>
          ${ahead > 0 ? `<span class="git-ahead">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2l3 3H9v6H7V5H5l3-3z"/>
            </svg>${ahead}
          </span>` : ''}
          ${behind > 0 ? `<span class="git-behind">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 14l-3-3h2V5h2v6h2l-3 3z"/>
            </svg>${behind}
          </span>` : ''}
        </div>
        <div class="git-header-actions">
          ${ahead > 0 || behind > 0 ? `
            <button class="btn btn-sm git-sync-btn" onclick="gitPanel.syncChanges()" title="Sync Changes">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 3V1L5 4l3 3V5c3.31 0 6 2.69 6 6 0 .85-.18 1.65-.5 2.37l1.5 1.5C15.55 13.53 16 11.84 16 10c0-4.42-3.58-8-8-8z"/>
                <path d="M8 13v2l3-3-3-3v2c-3.31 0-6-2.69-6-6 0-.85.18-1.65.5-2.37L1 1.13C.45 2.47 0 4.16 0 6c0 4.42 3.58 8 8 8z"/>
              </svg>
            </button>
          ` : ''}
          <button class="btn btn-sm git-refresh-btn" onclick="gitPanel.refreshStatus()" title="Refresh">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2.5a5.5 5.5 0 00-5.207 3.777.5.5 0 01-.943-.334A6.5 6.5 0 0113.5 8a.5.5 0 01-1 0A5.5 5.5 0 008 2.5z"/>
              <path d="M1.5 8a.5.5 0 01.5-.5 5.5 5.5 0 005.207 3.777.5.5 0 01.943.334A6.5 6.5 0 012.5 8a.5.5 0 01-1 0z"/>
              <path d="M10 3L8.5 4.5 10 6"/>
              <path d="M6 13l1.5-1.5L6 10"/>
            </svg>
          </button>
        </div>
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
            onfocus="gitPanel.handleCommitInputFocus(event)"
          >${this.commitMessage}</textarea>
          <div class="git-commit-actions">
            <div class="git-commit-btn-group">
              <button 
                class="btn btn-primary git-commit-btn" 
                onclick="gitPanel.commit()"
                ${!this.commitMessage.trim() ? 'disabled' : ''}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z"/>
                </svg>
                Commit
              </button>
              <div class="git-commit-dropdown">
                <button class="btn btn-primary git-commit-dropdown-btn" onclick="gitPanel.toggleCommitDropdown(event)">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 6l4 4 4-4H4z"/>
                  </svg>
                </button>
                <div class="git-commit-dropdown-menu" style="display: none;">
                  <button class="git-commit-option" onclick="gitPanel.commit()">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z"/>
                    </svg>
                    Commit
                  </button>
                  <button class="git-commit-option" onclick="gitPanel.commitAndPush()">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 2l3 3H9v6H7V5H5l3-3z"/>
                    </svg>
                    Commit & Push
                  </button>
                  <button class="git-commit-option" onclick="gitPanel.commitAmend()">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 16A8 8 0 108 0a8 8 0 000 16zM5.354 6.646a.5.5 0 01.708 0L8 8.586l1.938-1.94a.5.5 0 01.708.708L9.414 8.5l1.232 1.232a.5.5 0 01-.708.708L8 8.5 6.062 10.44a.5.5 0 01-.708-.708L6.586 8.5 5.354 7.268a.5.5 0 010-.708z"/>
                    </svg>
                    Commit (Amend)
                  </button>
                </div>
              </div>
            </div>
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
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              ${file.staged ? 
                '<path d="M4 8h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' : 
                '<path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
              }
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  getStatusIcon(status) {
    const icons = {
      'M': '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill="currentColor"/></svg>', // Modified
      'A': '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', // Added
      'D': '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 8h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', // Deleted
      'R': '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h12m-4-4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', // Renamed
      'C': '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2h8v12H4z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M2 4h8v12H2z" stroke="currentColor" stroke-width="2" fill="none"/></svg>', // Copied
      'U': '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v12M8 6l-3 3M8 6l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', // Unmerged
      '?': '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M6 6c0-1.1.9-2 2-2s2 .9 2 2c0 1-1 1.5-2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="11" r="1" fill="currentColor"/></svg>', // Untracked
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

  handleCommitInputFocus(event) {
    // Ensure the textarea stays focused and prevent event bubbling
    event.stopPropagation();
    // Store the textarea reference to prevent losing focus
    this.activeTextarea = event.target;
  }

  toggleCommitDropdown(event) {
    event.stopPropagation();
    const dropdown = event.target.closest('.git-commit-dropdown').querySelector('.git-commit-dropdown-menu');
    const isVisible = dropdown.style.display !== 'none';
    
    // Close all other dropdowns
    document.querySelectorAll('.git-commit-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
    
    // Toggle this dropdown
    dropdown.style.display = isVisible ? 'none' : 'block';
    
    // Close dropdown when clicking outside
    if (!isVisible) {
      setTimeout(() => {
        const closeDropdown = (e) => {
          if (!e.target.closest('.git-commit-dropdown')) {
            dropdown.style.display = 'none';
            document.removeEventListener('click', closeDropdown);
          }
        };
        document.addEventListener('click', closeDropdown);
      }, 10);
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

  async commitAndPush() {
    if (!this.commitMessage.trim()) {
      this.showNotification('Commit message is required', 'error');
      return;
    }

    if (!this.workspacePath) return;

    try {
      // First commit
      await window.__TAURI__.core.invoke('git_commit', { 
        path: this.workspacePath, 
        message: this.commitMessage 
      });
      
      // Then push
      await window.__TAURI__.core.invoke('git_push', { 
        path: this.workspacePath, 
        remote: null, 
        branch: null 
      });
      
      this.commitMessage = '';
      this.showNotification('Committed and pushed successfully', 'success');
      await this.refreshStatus();
    } catch (error) {
      console.error('Error committing and pushing:', error);
      this.showNotification('Failed to commit and push: ' + error, 'error');
    }
  }

  async commitAmend() {
    if (!this.commitMessage.trim()) {
      this.showNotification('Commit message is required', 'error');
      return;
    }

    if (!this.workspacePath) return;

    try {
      // Use git commit --amend
      await window.__TAURI__.core.invoke('run_command', { 
        command: 'git',
        args: ['commit', '--amend', '-m', this.commitMessage],
        cwd: this.workspacePath
      });
      
      this.commitMessage = '';
      this.showNotification('Commit amended successfully', 'success');
      await this.refreshStatus();
    } catch (error) {
      console.error('Error amending commit:', error);
      this.showNotification('Failed to amend commit: ' + error, 'error');
    }
  }

  async syncChanges() {
    if (!this.workspacePath) return;

    try {
      this.showNotification('Syncing changes...', 'info');
      
      // Fetch first to get latest changes
      await window.__TAURI__.core.invoke('git_fetch', { 
        path: this.workspacePath, 
        remote: null 
      });
      
      // Then pull
      await window.__TAURI__.core.invoke('git_pull', { 
        path: this.workspacePath, 
        remote: null, 
        branch: null 
      });
      
      // Then push if we have ahead commits
      if (this.gitStatus && this.gitStatus.ahead > 0) {
        await window.__TAURI__.core.invoke('git_push', { 
          path: this.workspacePath, 
          remote: null, 
          branch: null 
        });
      }
      
      this.showNotification('Synced successfully', 'success');
      await this.refreshStatus();
    } catch (error) {
      console.error('Error syncing:', error);
      this.showNotification('Failed to sync: ' + error, 'error');
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
