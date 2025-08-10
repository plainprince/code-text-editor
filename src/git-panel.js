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
      const commitInput = document.querySelector('.git-commit-input');
      const hadFocus = document.activeElement === commitInput;
      const selectionStart = commitInput?.selectionStart;
      const selectionEnd = commitInput?.selectionEnd;

      this.gitStatus = await window.__TAURI__.core.invoke('git_status', { 
        path: this.workspacePath 
      });
      this.renderContent();

      if (hadFocus) {
        const newCommitInput = document.querySelector('.git-commit-input');
        if (newCommitInput) {
          newCommitInput.focus();
          newCommitInput.setSelectionRange(selectionStart, selectionEnd);
        }
      }
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
              <path d="M9.5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm1.28 1.22a.75.75 0 0 0-1.06 0L8 6.22l-1.72-1.75a.75.75 0 0 0-1.06 1.06L6.94 7.5l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 8.56l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 7.5l1.72-1.72a.75.75 0 0 0 0-1.06zM3.75 3a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm0 9a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm8.5-9a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z"></path>
            </svg>
          </span>
          <span class="git-branch-name">${branch || 'No branch'}</span>
          ${ahead > 0 ? `<span class="git-ahead">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1.2l-4 4 1.4 1.4 1.6-1.6v8h2v-8l1.6 1.6 1.4-1.4-4-4z"/>
            </svg>${ahead}
          </span>` : ''}
          ${behind > 0 ? `<span class="git-behind">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 14.8l4-4-1.4-1.4-1.6 1.6v-8h-2v8l-1.6-1.6-1.4 1.4 4 4z"/>
            </svg>${behind}
          </span>` : ''}
        </div>
        <div class="git-header-actions">
          <button class="btn btn-sm git-sync-btn" onclick="gitPanel.syncChanges()" title="Sync Changes">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="octicon octicon-sync">
              <path fill-rule="evenodd" d="M8 2.5a5.5 5.5 0 103.407 9.458l.09.063.03.018.028.016.033.018.02.01.034.017.022.008.035.012.02.006.038.01.018.004.04.008.017.003.04.006.014.002.043.004h.001a.5.5 0 00.499-1 .5.5 0 00-.499-1h-.002l-.04-.004a4.5 4.5 0 11-2.99-8.498.5.5 0 10.998.05A5.5 5.5 0 008 2.5zM12 8a4 4 0 11-8 0 4 4 0 018 0zm-1.124.819a.5.5 0 00-.632-.782l-1.5 1.2V5.5a.5.5 0 00-1 0v3.737l-1.5-1.2a.5.5 0 00-.632.782l2.25 1.8a.5.5 0 00.632 0l2.25-1.8z"></path>
            </svg>
          </button>
          <button class="btn btn-sm git-refresh-btn" onclick="gitPanel.refreshStatus()" title="Refresh">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="octicon octicon-sync">
                <path fill-rule="evenodd" d="M8 2.5a5.5 5.5 0 103.407 9.458l.09.063.03.018.028.016.033.018.02.01.034.017.022.008.035.012.02.006.038.01.018.004.04.008.017.003.04.006.014.002.043.004h.001a.5.5 0 00.499-1 .5.5 0 00-.499-1h-.002l-.04-.004a4.5 4.5 0 11-2.99-8.498.5.5 0 10.998.05A5.5 5.5 0 008 2.5zM12 8a4 4 0 11-8 0 4 4 0 018 0zm-1.124.819a.5.5 0 00-.632-.782l-1.5 1.2V5.5a.5.5 0 00-1 0v3.737l-1.5-1.2a.5.5 0 00-.632.782l2.25 1.8a.5.5 0 00.632 0l2.25-1.8z"></path>
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
                  <path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
                </svg>
                Commit
              </button>
              <div class="git-commit-dropdown">
                <button class="btn btn-primary git-commit-dropdown-btn" onclick="gitPanel.toggleCommitDropdown(event)">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06z"/>
                  </svg>
                </button>
                <div class="git-commit-dropdown-menu" style="display: none;">
                  <button class="git-commit-option" onclick="gitPanel.commit()">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
                    </svg>
                    Commit
                  </button>
                  <button class="git-commit-option" onclick="gitPanel.commitAndPush()">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1.2l-4 4 1.4 1.4 1.6-1.6v8h2v-8l1.6 1.6 1.4-1.4-4-4z"/>
                    </svg>
                    Commit & Push
                  </button>
                  <button class="git-commit-option" onclick="gitPanel.commitAmend()">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path fill-rule="evenodd" d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.25 1.083a.75.75 0 0 1-.918-.918l1.083-3.25a1.75 1.75 0 0 1 .445-.756l8.61-8.61zM12.25 3.5l-6.5 6.5-1.5 1.5.75.75 1.5-1.5 6.5-6.5-1.25-1.25z"/>
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
                '<path fill-rule="evenodd" d="M2 7.75A.75.75 0 0 1 2.75 7h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 7.75z"/>' : 
                '<path fill-rule="evenodd" d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 1 1 0 1.5H8.5v4.25a.75.75 0 1 1-1.5 0V8.5H2.75a.75.75 0 1 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2z"/>'
              }
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  getStatusIcon(status) {
    const icons = {
      'M': '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8z"/></svg>', // Modified
      'A': '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 110 1.5H8.5v4.25a.75.75 0 11-1.5 0V8.5H2.75a.75.75 0 110-1.5H7V2.75A.75.75 0 017.75 2z"/></svg>', // Added
      'D': '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M2 7.75A.75.75 0 012.75 7h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 7.75z"/></svg>', // Deleted
      'R': '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8.22 2.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 8 8.22 4.28a.75.75 0 010-1.06zM3.22 2.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L4.28 12.78a.75.75 0 01-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 010-1.06z"/></svg>', // Renamed
      'C': '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5zm5-5.25A1.75 1.75 0 016.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.5.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/></svg>', // Copied
      'U': '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8.22 1.75c.414 0 .75.336.75.75v6.5a.75.75 0 01-1.5 0v-6.5a.75.75 0 01.75-.75zM8 13a1 1 0 100-2 1 1 0 000 2z"/><path fill-rule="evenodd" d="M8.973.255a2.25 2.25 0 00-1.946 0L.942 6.164a.25.25 0 00.193.436H14.86a.25.25 0 00.193-.436L8.973.255zM8 1.5L13.84 6.75H2.16L8 1.5z"/></svg>', // Unmerged
      '?': '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm8-3.5a.75.75 0 01.75.75v2.5a.75.75 0 01-1.5 0v-2.5A.75.75 0 018 4.5zM8 11a1 1 0 100-2 1 1 0 000 2z"/></svg>', // Untracked
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
