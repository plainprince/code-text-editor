/**
 * explorer-history.js
 * Manages the history of file operations for undo functionality.
 */

export default class ExplorerHistory {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        this.historyStack = [];
        this.undoStack = [];
    }

    /**
     * Adds a new action to the history stack.
     * @param {object} action - The action to add, e.g., { type: 'move', from, to }.
     */
    addAction(action) {
        this.historyStack.push(action);
        // Clearing the undo stack whenever a new action is performed.
        this.undoStack = [];
    }

    /**
     * Undoes the last action.
     */
    async undo() {
        if (this.historyStack.length === 0) return;

        const lastAction = this.historyStack.pop();
        this.undoStack.push(lastAction);

        switch (lastAction.type) {
            case 'move':
                await this.fileExplorer.actions.moveItem(lastAction.to, lastAction.from, true);
                break;
            case 'create':
                await this.fileExplorer.actions.deleteItem(lastAction.path, true);
                break;
            case 'delete':
                // This is a simplified restore. A real implementation would need content.
                await this.fileExplorer.actions.createNewFile(lastAction.path, true);
                break;
            case 'rename':
                await this.fileExplorer.actions.moveItem(lastAction.to, lastAction.from, true);
                break;
            case 'trash':
                await this.fileExplorer.actions.moveItem(lastAction.trashPath, lastAction.path, true);
                break;
        }
    }

    /**
     * Redoes the last undone action.
     */
    async redo() {
        if (this.undoStack.length === 0) return;

        const lastUndo = this.undoStack.pop();
        this.historyStack.push(lastUndo);

        switch (lastUndo.type) {
            case 'move':
                await this.fileExplorer.actions.moveItem(lastUndo.from, lastUndo.to, true);
                break;
            case 'create':
                await this.fileExplorer.actions.createNewFile(lastUndo.path, true);
                break;
            case 'delete':
                await this.fileExplorer.actions.deleteItem(lastUndo.path, true);
                break;
            case 'rename':
                await this.fileExplorer.actions.moveItem(lastUndo.from, lastUndo.to, true);
                break;
            case 'trash':
                await this.fileExplorer.actions.trashItem(lastUndo.path, true);
                break;
        }
    }
}
