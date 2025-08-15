import { Modal } from './modal.js';

export class SnapshotManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.isInitialized = false;
  }

  async init() {
    if (!this.workspaceRoot) return;
    try {
      const isInstalled = await this.checkGitInstallation();
      if (!isInstalled) {
        Modal.showCustomDialog(
          'Git Not Found',
          'Git is not installed or not in your PATH. Please install it to use the snapshot feature. <br><br> <a href="https://git-scm.com/" target="_blank">Download Git</a>',
          [{ label: 'OK', value: 'ok', className: 'btn-primary' }]
        );
        return;
      }
      // Check if it's already a git repository
      try {
        const output = await window.__TAURI__.core.invoke('run_command', {
          command: 'git',
          args: ['-C', this.workspaceRoot, 'rev-parse', '--is-inside-work-tree'],
          cwd: '.'
        });
        
        if (output.trim() === 'true') {
          this.isInitialized = true;
          return;
        }
      } catch (error) {
        // Not a git repository, initialize one
      }

      // If not, initialize a new git repository
      await window.__TAURI__.core.invoke('run_command', {
        command: 'git',
        args: ['-C', this.workspaceRoot, 'init'],
        cwd: '.'
      });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize snapshot manager:', error);
      Modal.alert('Snapshot Error', 'Could not initialize the snapshot functionality. Git might not be installed or accessible.');
    }
  }

  async checkGitInstallation() {
    try {
      if (!window.__TAURI__) return false;
      await window.__TAURI__.core.invoke('run_command', {
        command: 'git',
        args: ['--version'],
        cwd: '.'
      });
      return true; // If we get here, the command succeeded
    } catch (error) {
      return false;
    }
  }

  async createSnapshot(message) {
    if (!this.isInitialized) return null;

    try {
      await window.__TAURI__.core.invoke('run_command', {
        command: 'git',
        args: ['-C', this.workspaceRoot, 'add', '-A'],
        cwd: '.'
      });
      
      await window.__TAURI__.core.invoke('run_command', {
        command: 'git',
        args: ['-C', this.workspaceRoot, 'commit', '-m', message],
        cwd: '.'
      });
      
      const revParse = await window.__TAURI__.core.invoke('run_command', {
        command: 'git',
        args: ['-C', this.workspaceRoot, 'rev-parse', 'HEAD'],
        cwd: '.'
      });
      
      return revParse.trim();
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      return null;
    }
  }

  async rollbackTo(commitHash) {
    if (!this.isInitialized) return;

    try {
      await window.__TAURI__.core.invoke('run_command', {
        command: 'git',
        args: ['-C', this.workspaceRoot, 'reset', '--hard', commitHash],
        cwd: '.'
      });
      Modal.alert('Success', `Rolled back to snapshot ${commitHash.substring(0, 7)}.`);
      // You'll need to refresh the file explorer and open tabs after this.
    } catch (error) {
      console.error('Failed to rollback:', error);
      Modal.alert('Rollback Error', 'Could not roll back to the selected snapshot.');
    }
  }
}
