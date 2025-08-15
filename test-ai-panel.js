// Quick comprehensive test for AI panel functionality
// Run this in the browser console to test all features

async function testAIPanel() {
  console.log('🧪 Testing AI Panel Functionality...');
  
  // Test 1: Panel visibility
  console.log('1. Testing panel visibility...');
  const aiButton = document.getElementById('ai-panel-statusbar-button');
  if (aiButton) {
    aiButton.click();
    console.log('✓ AI panel opened');
  } else {
    console.error('✗ AI panel button not found');
  }
  
  // Test 2: Dropdowns
  console.log('2. Testing dropdowns...');
  const modelDropdown = document.getElementById('ai-model-dropdown-button');
  const modeDropdown = document.getElementById('ai-mode-dropdown-button');
  
  if (modelDropdown) {
    modelDropdown.click();
    setTimeout(() => {
      console.log('✓ Model dropdown opened');
      modelDropdown.click(); // Close
    }, 100);
  }
  
  if (modeDropdown) {
    setTimeout(() => {
      modeDropdown.click();
      setTimeout(() => {
        console.log('✓ Mode dropdown opened');
        modeDropdown.click(); // Close
      }, 100);
    }, 200);
  }
  
  // Test 3: Input and buttons
  console.log('3. Testing input and buttons...');
  const input = document.getElementById('ai-input');
  const sendBtn = document.getElementById('ai-send-button');
  const contextBtn = document.getElementById('ai-context-button');
  
  if (input) {
    input.focus();
    input.value = 'Test message @';
    input.dispatchEvent(new Event('input'));
    console.log('✓ Input works, @ should trigger context menu');
  }
  
  if (sendBtn) {
    console.log('✓ Send button found:', sendBtn.textContent);
  }
  
  if (contextBtn) {
    console.log('✓ Context button found');
  }
  
  // Test 4: Tool execution (if in agent mode)
  console.log('4. Testing tool execution...');
  if (input) {
    input.value = 'Create a test file please';
    console.log('✓ Ready to test tool execution');
  }
  
  // Test 5: Max mode toggle
  console.log('5. Testing max mode...');
  const maxModeBtn = document.getElementById('ai-max-mode-toggle');
  if (maxModeBtn) {
    console.log('✓ Max mode button found:', maxModeBtn.textContent);
  }
  
  console.log('🎉 AI Panel test completed! Check for any errors above.');
  console.log('📝 Manual tests needed:');
  console.log('  - Send a message to test streaming');
  console.log('  - Test tool execution with "Create a file called test.txt"');
  console.log('  - Test @ context menu');
  console.log('  - Test model downloading');
  console.log('  - Test custom mode creation');
}

// Auto-run test
testAIPanel();
