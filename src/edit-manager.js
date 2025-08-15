import { Decoration, WidgetType } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';

const addPendingEdit = StateEffect.define();
const clearPendingEdits = StateEffect.define();

export const pendingEditsField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    value = value.map(tr.changes);
    for (let effect of tr.effects) {
      if (effect.is(addPendingEdit)) {
        const { from, to, insert } = effect.value;
        const decoration = Decoration.replace({
          widget: new InlineEditWidget(insert, () => {
            // This is where you would dispatch a transaction to accept the change
          }),
        });
        value = value.update({ add: [decoration.range(from, to)] });
      }
      if (effect.is(clearPendingEdits)) {
        value = Decoration.none;
      }
    }
    return value;
  },
  provide: f => f,
});

class InlineEditWidget extends WidgetType {
  constructor(content, onAccept) {
    super();
    this.content = content;
    this.onAccept = onAccept;
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-pending-edit';
    span.textContent = this.content;

    const acceptButton = document.createElement('button');
    acceptButton.textContent = 'Accept';
    acceptButton.onclick = this.onAccept;
    span.appendChild(acceptButton);

    return span;
  }
}

export class EditManager {
  constructor(editorView) {
    this.editorView = editorView;
    this.pendingEdits = new Map();
  }

  addPendingEdit(filePath, from, to, insert) {
    if (!this.pendingEdits.has(filePath)) {
      this.pendingEdits.set(filePath, []);
    }
    this.pendingEdits.get(filePath).push({ from, to, insert });
    
    // If the file is active, apply the overlay
    if (this.editorView.state.doc.filePath === filePath) {
      this.applyOverlay(filePath);
    }
  }

  applyOverlay(filePath) {
    const edits = this.pendingEdits.get(filePath) || [];
    const effects = edits.map(({ from, to, insert }) => addPendingEdit.of({ from, to, insert }));
    this.editorView.dispatch({ effects });
  }

  acceptAll() {
    // This needs to be implemented. 
    // It should iterate through all pending edits and apply them.
  }
  
  rejectAll() {
    // This needs to be implemented.
    // It should clear all pending edits and overlays.
  }
}
