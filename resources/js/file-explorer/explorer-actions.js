/**
 * explorer-actions.js
 * File/folder actions for the File Explorer (move, copy, delete, rename, etc.)
 * All actions should be async and return Promises.
 */

export default class ExplorerActions {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer; // Reference to main FileExplorer instance
    }

    // Move file or folder
    async moveItem(src, dest) {
        try {
            await Neutralino.filesystem.moveFile(src, dest);
            this.fileExplorer.loadCurrentDirectory();
            return true;
        } catch (e) {
            this.fileExplorer.showNotification({ message: `Error moving item: ${e.message}`, type: 'error' });
            return false;
        }
    }

    // Duplicate file or folder
    async duplicateItem(src) {
        const name = src.substring(src.lastIndexOf('/') + 1);
        const path = src.substring(0, src.lastIndexOf('/'));
        const ext = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';
        const baseName = ext ? name.substring(0, name.lastIndexOf('.')) : name;
        const dest = `${path}/${baseName}_copy${ext}`;

        try {
            await Neutralino.filesystem.copy(src, dest);
            this.fileExplorer.history.addAction({ type: 'create', path: dest });
            this.fileExplorer.loadCurrentDirectory();
        } catch (e) {
            this.fileExplorer.showNotification({ message: `Error duplicating item: ${e.message}`, type: 'error' });
        }
    }

    // Rename file or folder
    async renameItem(src) {
        const newName = await this.fileExplorer.showInputDialog("Rename", "Enter new name:", src.split('/').pop());
        if (!newName) return;
        
        const dest = `${src.substring(0, src.lastIndexOf('/'))}/${newName}`;

        try {
            await Neutralino.filesystem.moveFile(src, dest);
            this.fileExplorer.history.addAction({ type: 'rename', from: src, to: dest });
            this.fileExplorer.loadCurrentDirectory();
        } catch (e) {
            this.fileExplorer.showNotification({ message: `Error renaming item: ${e.message}`, type: 'error' });
        }
    }

    // Trash (move to trash) file or folder
    async trashItem(path) {
        try {
            const trashPath = await this.getTrashPath();
            if (!trashPath) {
                this.fileExplorer.showNotification({ message: 'Trash folder not found.', type: 'error' });
                return;
            }
            
            const dest = `${trashPath}/${path.split('/').pop()}`;
            await Neutralino.filesystem.moveFile(path, dest);
            this.fileExplorer.history.addAction({ type: 'trash', path: path, trashPath: dest });
            this.fileExplorer.loadCurrentDirectory();
        } catch (e) {
            this.fileExplorer.showNotification({ message: `Error trashing item: ${e.message}`, type: 'error' });
        }
    }

    // Permanently delete file or folder
    async deleteItem(path, isUndo = false) {
        if (!isUndo) {
            const confirmed = await this.fileExplorer.showConfirmDialog("Delete Item", `Are you sure you want to permanently delete ${path}?`);
            if (!confirmed) return;
        }

        try {
            await Neutralino.filesystem.remove(path);
            if (!isUndo) {
                this.fileExplorer.history.addAction({ type: 'delete', path });
            }
            this.fileExplorer.loadCurrentDirectory();
        } catch (e) {
            this.fileExplorer.showNotification({ message: `Error deleting item: ${e.message}`, type: 'error' });
        }
    }

    // Create a new file
    async createNewFile(path, isUndo = false) {
        let fileName = path;
        if (!isUndo) {
            const name = await this.fileExplorer.showInputDialog("New File", "Enter file name:");
            if (!name) return;
            fileName = `${path}/${name}`;
        }
        
        try {
          await Neutralino.filesystem.writeFile(fileName, "");
          if (!isUndo) {
            this.fileExplorer.history.addAction({ type: 'create', path: fileName });
          }
          this.fileExplorer.loadCurrentDirectory(); // Refresh explorer
        } catch (e) {
          this.fileExplorer.showNotification({ message: `Error creating file: ${e.message}`, type: 'error' });
        }
    }

    // Create a new folder
    async createNewFolder(path, isUndo = false) {
        let folderName = path;
        if (!isUndo) {
            const name = await this.fileExplorer.showInputDialog("New Folder", "Enter folder name:");
            if (!name) return;
            folderName = `${path}/${name}`;
        }

        try {
          await Neutralino.filesystem.createDirectory(folderName);
          if (!isUndo) {
            this.fileExplorer.history.addAction({ type: 'create', path: folderName });
          }
          this.fileExplorer.loadCurrentDirectory(); // Refresh explorer
        } catch (e) {
          this.fileExplorer.showNotification({ message: `Error creating folder: ${e.message}`, type: 'error' });
        }
    }

    // Open a file in its default application
    async openFile(path) {
        try {
            await Neutralino.os.open(path);
        } catch (e)
        {
            this.fileExplorer.showNotification({ message: `Error opening file: ${e.message}`, type: 'error' });
        }
    }

    async getTrashPath() {
        const homeDir = await this.getHomeDir();
        if (!homeDir) {
            this.fileExplorer.showNotification({ message: 'Could not determine home directory.', type: 'error' });
            return null;
        }

        switch (NL_OS) {
            case 'Darwin': // macOS
                return `${homeDir}/.Trash`;
            case 'Windows':
                // This is a simplified path. A real implementation would be more complex.
                return `${homeDir}/AppData/Local/Microsoft/Windows/RecycleBin`;
            default: // Linux and other UNIX-like systems
                return `${homeDir}/.local/share/Trash/files`;
        }
    }

    async getHomeDir() {
        try {
            // Using 'documents' path to infer home directory, a common workaround
            const docPath = await Neutralino.os.getPath('documents');
            // Typically, the path is /Users/{username}/Documents or C:\Users\{username}\Documents
            // We can infer the home path by going up one level.
            return docPath.substring(0, docPath.lastIndexOf('/'));
        } catch (e) {
            console.error('Could not get documents path:', e);
            return null;
        }
    }
}
