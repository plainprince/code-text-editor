// src/language-server-dep-manager.js

import { getAppSupportDir, runCommand } from './tauri-helpers.js';
import { fileExists, createDirectory } from './file-system.js';

class LanguageServerDependencyManager {
    constructor() {
        this.supportDir = null;
        this.npmPath = 'npm'; // or a bundled npm
        this.initialized = false;
        this.installations = new Map(); // serverCommand -> status
    }

    async initialize() {
        if (this.initialized) return;

        try {
            this.supportDir = await getAppSupportDir();
            const serversDir = `${this.supportDir}/servers`;
            if (!await fileExists(serversDir)) {
                await createDirectory(serversDir);
            }
            this.serversDir = serversDir;

            const packageJsonPath = `${this.serversDir}/package.json`;
            if (!await fileExists(packageJsonPath)) {
                await runCommand('npm', ['init', '-y'], this.serversDir);
            }

            this.initialized = true;
            console.log('[LSDepManager] Initialized successfully. Servers directory:', this.serversDir);
        } catch (error) {
            console.error('[LSDepManager] Failed to initialize:', error);
            this.initialized = false;
        }
    }

    getServerExecutablePath(serverCommand) {
        return `${this.serversDir}/node_modules/.bin/${serverCommand}`;
    }

    async isServerInstalled(serverCommand) {
        if (!this.initialized) {
            console.error('[LSDepManager] Not initialized. Cannot check for server installation.');
            return false;
        }
        const executablePath = this.getServerExecutablePath(serverCommand);
        return await fileExists(executablePath);
    }

    async installServer(serverCommand, npmPackage) {
        if (!this.initialized) {
            console.error(`[LSDepManager] Not initialized. Cannot install ${npmPackage}.`);
            return false;
        }

        console.log(`[LSDepManager] Installing ${npmPackage}...`);
        this.installations.set(serverCommand, 'installing');
        try {
            await runCommand('npm', ['install', npmPackage], this.serversDir);
            console.log(`[LSDepManager] Successfully installed ${npmPackage}.`);
            this.installations.set(serverCommand, 'installed');
            return true;
        } catch (error) {
            console.error(`[LSDepManager] Failed to install ${npmPackage}:`, error);
            this.installations.set(serverCommand, 'failed');
            return false;
        }
    }

    async ensureServerInstalled(serverCommand, npmPackage) {
        const isInstalled = await this.isServerInstalled(serverCommand);
        if (isInstalled) {
            console.log(`[LSDepManager] ${serverCommand} is already installed.`);
            return true;
        }

        return await this.installServer(serverCommand, npmPackage);
    }
}

const lsDepManager = new LanguageServerDependencyManager();
export default lsDepManager;
