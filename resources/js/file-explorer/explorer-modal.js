/**
 * explorer-modal.js
 * Modal dialog logic for the file explorer.
 * Handles input dialogs, confirm dialogs, overlays, and click-outside-to-close.
 */

export class ExplorerModal {
    constructor(modalElement) {
        this.modal = modalElement;
    }

    showInputDialog(title, message, defaultValue = "") {
        return new Promise((resolve) => {
            this.modal.innerHTML = `
                <div class="dialog-overlay">
                  <div class="input-dialog">
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <input type="text" value="${defaultValue}" class="input-field">
                    <div class="dialog-buttons">
                      <button class="cancel-btn">Cancel</button>
                      <button class="ok-btn">OK</button>
                    </div>
                  </div>
                </div>
            `;
            this.modal.style.display = "block";
            const overlay = this.modal.querySelector(".dialog-overlay");
            const input = this.modal.querySelector(".input-field");
            input.focus();
            input.select();

            // Click outside to close
            overlay.addEventListener("mousedown", (e) => {
                if (e.target === overlay) {
                    this.modal.style.display = "none";
                    resolve(null);
                }
            });

            this.modal.querySelector(".ok-btn").addEventListener("click", () => {
                const value = input.value.trim();
                this.modal.style.display = "none";
                resolve(value);
            });

            this.modal.querySelector(".cancel-btn").addEventListener("click", () => {
                this.modal.style.display = "none";
                resolve(null);
            });

            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    this.modal.querySelector(".ok-btn").click();
                } else if (e.key === "Escape") {
                    this.modal.querySelector(".cancel-btn").click();
                }
            });
        });
    }

    showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            this.modal.innerHTML = `
                <div class="dialog-overlay">
                  <div class="confirm-dialog">
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <div class="dialog-buttons">
                      <button class="cancel-btn">Cancel</button>
                      <button class="confirm-btn">Confirm</button>
                    </div>
                  </div>
                </div>
            `;
            this.modal.style.display = "block";
            const overlay = this.modal.querySelector(".dialog-overlay");

            // Click outside to close
            overlay.addEventListener("mousedown", (e) => {
                if (e.target === overlay) {
                    this.modal.style.display = "none";
                    resolve(false);
                }
            });

            this.modal.querySelector(".confirm-btn").addEventListener("click", () => {
                this.modal.style.display = "none";
                resolve(true);
            });

            this.modal.querySelector(".cancel-btn").addEventListener("click", () => {
                this.modal.style.display = "none";
                resolve(false);
            });
        });
    }

    hide() {
        this.modal.style.display = "none";
    }
}
