// Debug script to check AI panel issues
// Paste this in browser console to debug

console.log('🔍 Debugging AI Panel...');

// Check if elements exist
const aiButton = document.getElementById('ai-panel-statusbar-button');
const aiPanel = document.getElementById('ai-panel');
const sidebarRight = document.getElementById('sidebar-right');
const mainRow = document.getElementById('main-row');

console.log('Elements found:');
console.log('- AI button:', !!aiButton);
console.log('- AI panel:', !!aiPanel);
console.log('- Sidebar right:', !!sidebarRight);
console.log('- Main row:', !!mainRow);

if (aiButton) {
  console.log('AI button text:', aiButton.textContent);
  console.log('AI button classes:', aiButton.className);
  
  // Check if click handler is attached
  console.log('AI button onclick:', aiButton.onclick);
  
  // Try manual click
  console.log('Testing manual click...');
  try {
    aiButton.click();
    console.log('✓ Click successful');
  } catch (e) {
    console.error('✗ Click failed:', e);
  }
}

if (sidebarRight) {
  console.log('Sidebar right display:', sidebarRight.style.display);
  console.log('Sidebar right classes:', sidebarRight.className);
}

if (mainRow) {
  console.log('Main row classes:', mainRow.className);
  console.log('Main row has right-sidebar-visible:', mainRow.classList.contains('right-sidebar-visible'));
}

if (aiPanel) {
  console.log('AI panel display:', aiPanel.style.display);
  console.log('AI panel classes:', aiPanel.className);
}

// Check for JavaScript errors
console.log('Window error events:', window.onerror);

// Test setRightPanel function directly
if (typeof setRightPanel === 'function') {
  console.log('setRightPanel function exists');
  try {
    console.log('Testing setRightPanel("ai-panel")...');
    setRightPanel('ai-panel');
    console.log('✓ setRightPanel call successful');
  } catch (e) {
    console.error('✗ setRightPanel failed:', e);
  }
} else {
  console.error('✗ setRightPanel function not found');
}

// Check currentRightPanel variable
if (typeof currentRightPanel !== 'undefined') {
  console.log('currentRightPanel:', currentRightPanel);
} else {
  console.error('✗ currentRightPanel variable not found');
}
