// modal.js - Modal dialog system

export class Modal {
  static showDialog(title, message, type = 'info', defaultValue = '') {
    return new Promise((resolve, reject) => {
      // Remove any existing modal
      const existingModal = document.querySelector('.modal-overlay');
      if (existingModal) {
        existingModal.remove();
      }

      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      
      // Create modal container
      const modal = document.createElement('div');
      modal.className = 'modal';
      
      // Create header
      const header = document.createElement('div');
      header.className = 'modal-header';
      header.innerHTML = `<h3>${title}</h3>`;
      
      // Create body
      const body = document.createElement('div');
      body.className = 'modal-body';
      
      if (message) {
        const messageEl = document.createElement('p');
        messageEl.textContent = message;
        body.appendChild(messageEl);
      }
      
      let inputEl = null;
      if (type === 'prompt') {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'modal-input';
        inputEl.value = defaultValue;
        inputEl.placeholder = 'Enter value...';
        body.appendChild(inputEl);
      }
      
      // Create footer
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      
      if (type === 'confirm' || type === 'prompt') {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
          overlay.remove();
          resolve(null);
        };
        footer.appendChild(cancelBtn);
      }
      
      const okBtn = document.createElement('button');
      okBtn.className = 'btn btn-primary';
      okBtn.textContent = type === 'confirm' ? 'OK' : (type === 'prompt' ? 'Create' : 'OK');
      okBtn.onclick = () => {
        overlay.remove();
        if (type === 'prompt') {
          resolve(inputEl.value.trim() || null);
        } else {
          resolve(true);
        }
      };
      footer.appendChild(okBtn);
      
      // Assemble modal
      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);
      
      // Add event listeners
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(null);
        }
      });
      
      document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', escHandler);
          overlay.remove();
          resolve(null);
        }
        if (e.key === 'Enter' && type === 'prompt' && inputEl) {
          document.removeEventListener('keydown', escHandler);
          overlay.remove();
          resolve(inputEl.value.trim() || null);
        }
      });
      
      // Add to DOM and focus
      document.body.appendChild(overlay);
      
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      } else {
        okBtn.focus();
      }
    });
  }
  
  static async prompt(title, message = '', defaultValue = '') {
    return await this.showDialog(title, message, 'prompt', defaultValue);
  }
  
  static async confirm(title, message = '') {
    return await this.showDialog(title, message, 'confirm');
  }
  
  static async alert(title, message = '') {
    return await this.showDialog(title, message, 'info');
  }
}