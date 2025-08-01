/**
 * explorer-dnd.js
 * Drag-and-drop logic for the file explorer.
 *
 * Exports:
 *   - setupExplorerDnD(FileExplorerInstance)
 *   - (optionally) helper functions for drag/drop events
 */

export function setupExplorerDnD(fileExplorer) {
    const sidebar = document.getElementById('sidebar-left');
    let dragSrcEl = null;
    let isMouseDown = false;
    let mouseDownTarget = null;

    function handleDragStart(e) {
        dragSrcEl = e.target;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.innerHTML);
        isMouseDown = false; // Reset state when drag actually starts
    }

    function handleMouseMove(e) {
        if (!isMouseDown || !mouseDownTarget) return;

        // If we've moved the mouse, we're dragging.
        sidebar.removeEventListener('mousemove', handleMouseMove);
        
        mouseDownTarget.setAttribute('draggable', true);
        
        // Simulating a drag start event.
        const event = new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
        });
        mouseDownTarget.dispatchEvent(event);
    }

    function handleMouseDown(e) {
        // Only trigger for left-click
        if (e.button !== 0) return;

        const target = e.target.closest('.file-item, .folder-header');
        if (!target) return;
        
        isMouseDown = true;
        mouseDownTarget = target;
        
        // Add mousemove listener to detect drag
        sidebar.addEventListener('mousemove', handleMouseMove);
    }

    function handleMouseUp(e) {
        isMouseDown = false;
        sidebar.removeEventListener('mousemove', handleMouseMove);

        const target = e.target.closest('.file-item, .folder-header');
        if (target) {
            target.setAttribute('draggable', false);
        }
        if (mouseDownTarget) {
            mouseDownTarget.setAttribute('draggable', false);
        }
        mouseDownTarget = null;
    }


    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnter(e) {
        this.classList.add('over');
    }

    function handleDragLeave(e) {
        this.classList.remove('over');
    }

    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (dragSrcEl != this) {
            const srcPath = dragSrcEl.dataset.path;
            const destPath = this.dataset.path;
            fileExplorer.moveItem(srcPath, destPath);
        }
        
        return false;
    }

    function handleDragEnd(e) {
        const items = document.querySelectorAll('.file-item, .folder-header');
        items.forEach(function (item) {
            item.classList.remove('over');
        });
        if (dragSrcEl) {
            dragSrcEl.setAttribute('draggable', false);
        }
    }

    sidebar.addEventListener('mousedown', handleMouseDown, false);
    sidebar.addEventListener('mouseup', handleMouseUp, false);
    sidebar.addEventListener('dragstart', handleDragStart, false);
    sidebar.addEventListener('dragenter', handleDragEnter, false);
    sidebar.addEventListener('dragover', handleDragOver, false);
    sidebar.addEventListener('dragleave', handleDragLeave, false);
    sidebar.addEventListener('drop', handleDrop, false);
    sidebar.addEventListener('dragend', handleDragEnd, false);
}
