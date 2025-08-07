// src/language-server-dep-manager.js

import { getAppSupportDir, fileExists, createDirectory, runCommand } from './tauri-helpers.js';

class LanguageServerDepManager {
  constructor() {
    this.supportDir = null;
    this.npmPath = null;
    this.isInitialized = false;
    this.installationInProgress = new Set();
  }

  log(message, ...args) {
    console.log('[LanguageServerDepManager]', message, ...args);
  }

  error(message, ...args) {
    console.error('[LanguageServerDepManager ERROR]', message, ...args);
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.log('Initializing...');
      const dir = await getAppSupportDir();
      this.supportDir = `${dir}/language-servers/`;
      this.log('Support directory set to:', this.supportDir);

      const dirExists = await fileExists(this.supportDir);
      if (!dirExists) {
        this.log('Support directory does not exist, creating it...');
        await createDirectory(this.supportDir, { recursive: true });
      }

      const packageJsonPath = `${this.supportDir}package.json`;
      const packageJsonExists = await fileExists(packageJsonPath);
      if (!packageJsonExists) {
        this.log('package.json not found, initializing npm...');
        await runCommand('npm', ['init', '-y'], this.supportDir);
      }
      
      this.npmPath = 'npm'; // Assume npm is in PATH for now.
      this.isInitialized = true;
      this.log('Initialization complete.');
    } catch (err) {
      this.error('Initialization failed:', err);
      this.isInitialized = false;
    }
  }

  async ensureServerInstalled(serverName, npmPackage) {
    if (!this.isInitialized) {
      this.error('Manager is not initialized. Cannot install server.');
      return false;
    }
    
    if (this.installationInProgress.has(npmPackage)) {
        this.log(`Installation for ${npmPackage} is already in progress.`);
        return false;
    }

    try {
      const serverPath = `${this.supportDir}node_modules/${serverName}`;
      const serverExists = await fileExists(serverPath);

      if (serverExists) {
        this.log(`${serverName} is already installed at: ${serverPath}`);
        return true;
      }

      this.log(`Installing ${serverName} via npm package ${npmPackage}...`);
      this.installationInProgress.add(npmPackage);
      
      // Using 'install' which adds it to package.json and installs.
      await runCommand(this.npmPath, ['install', npmPackage, '--save-dev'], this.supportDir);
      
      this.log(`${npmPackage} installed successfully.`);
      return true;
    } catch (err) {
      this.error(`Failed to install ${npmPackage}:`, err);
      return false;
    } finally {
        this.installationInProgress.delete(npmPackage);
    }
  }

  getServerExecutablePath(serverName) {
    if (!this.isInitialized) return null;
    // This path needs to point to the actual binary inside the package.
    // This is a common pattern, but might need adjustment per-package.
    return `${this.supportDir}node_modules/.bin/${serverName}`;
  }
}

export default new LanguageServerDepManager();
