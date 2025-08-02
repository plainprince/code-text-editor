/**
 * Debug script for folder rendering issues
 * 
 * This script will run a series of tests to check folder rendering functionality
 * and log the results to the console.
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Starting folder rendering debug tests...');
  
  // Give the app a moment to initialize
  setTimeout(runTests, 1000);
});

async function runTests() {
  console.log('Running folder rendering tests...');
  
  // Test 1: Check if file explorer is initialized
  testFileExplorerInitialization();
  
  // Test 2: Add a test folder
  await testAddFolder();
  
  // Test 3: Test folder toggling
  await testFolderToggling();
  
  // Test 4: Test sub-folder rendering
  await testSubFolderRendering();
}

function testFileExplorerInitialization() {
  console.log('\n--- Test 1: File Explorer Initialization ---');
  
  // Check if the file explorer instance exists in the window
  if (!window.fileExplorer) {
    console.error('❌ File explorer instance not found on window object');
    return false;
  }
  
  console.log('✅ File explorer instance found');
  
  // Check if the sidebar exists
  const sidebar = document.getElementById('sidebar-left');
  if (!sidebar) {
    console.error('❌ Sidebar element not found');
    return false;
  }
  
  console.log('✅ Sidebar element found');
  
  // Check if the file list exists
  const fileList = document.getElementById('file-list');
  if (!fileList) {
    console.error('❌ File list element not found');
    return false;
  }
  
  console.log('✅ File list element found');
  return true;
}

async function testAddFolder() {
  console.log('\n--- Test 2: Add Test Folder ---');
  
  try {
    // Check if we can access the filesystem API
    if (!Neutralino || !Neutralino.filesystem) {
      console.error('❌ Neutralino filesystem API not available');
      return false;
    }
    
    console.log('✅ Neutralino filesystem API available');
    
    // Get the user's home directory
    const homeDir = await Neutralino.os.getPath('documents');
    console.log(`📁 Home directory: ${homeDir}`);
    
    // Add the folder to the file explorer
    await window.fileExplorer.addRootFolder(homeDir);
    console.log(`✅ Added folder: ${homeDir}`);
    
    // Check if the folder was added to the UI
    const rootFolders = document.querySelectorAll('.root-folder');
    if (rootFolders.length === 0) {
      console.error('❌ No root folders found in the UI');
      return false;
    }
    
    console.log(`✅ Found ${rootFolders.length} root folder(s) in the UI`);
    return true;
  } catch (error) {
    console.error('❌ Error adding test folder:', error);
    return false;
  }
}

async function testFolderToggling() {
  console.log('\n--- Test 3: Folder Toggling ---');
  
  try {
    // Find the first folder header
    const folderHeaders = document.querySelectorAll('.folder-header');
    if (folderHeaders.length === 0) {
      console.error('❌ No folder headers found');
      return false;
    }
    
    console.log(`✅ Found ${folderHeaders.length} folder header(s)`);
    
    // Get the first folder header
    const firstFolderHeader = folderHeaders[0];
    const folderPath = firstFolderHeader.dataset.path;
    console.log(`📁 Testing folder: ${folderPath}`);
    
    // Log the initial state
    const folderDiv = firstFolderHeader.closest('.file-folder');
    let contentDiv = folderDiv.querySelector('.folder-content');
    const initialDisplayStyle = contentDiv ? contentDiv.style.display : 'none';
    console.log(`Initial folder content display: ${initialDisplayStyle || 'not set (visible)'}`);
    
    // Toggle the folder open
    console.log('Opening folder...');
    await window.fileExplorer.toggleFolder(folderPath);
    
    // Check if the folder content is visible
    contentDiv = folderDiv.querySelector('.folder-content');
    if (!contentDiv) {
      console.error('❌ Folder content div not found after toggling open');
      return false;
    }
    
    console.log(`Folder content display after opening: ${contentDiv.style.display || 'not set (visible)'}`);
    console.log(`Folder content children: ${contentDiv.children.length}`);
    
    // Toggle the folder closed
    console.log('Closing folder...');
    await window.fileExplorer.toggleFolder(folderPath);
    
    // Check if the folder content is hidden
    contentDiv = folderDiv.querySelector('.folder-content');
    console.log(`Folder content display after closing: ${contentDiv.style.display}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error testing folder toggling:', error);
    return false;
  }
}

async function testSubFolderRendering() {
  console.log('\n--- Test 4: Sub-Folder Rendering ---');
  
  try {
    // Find all folders
    const folders = document.querySelectorAll('.file-folder');
    if (folders.length === 0) {
      console.error('❌ No folders found');
      return false;
    }
    
    console.log(`✅ Found ${folders.length} folder(s)`);
    
    // Find a folder that might have sub-folders
    let subfolderFound = false;
    
    for (const folder of folders) {
      const folderPath = folder.dataset.path;
      console.log(`📁 Checking folder: ${folderPath}`);
      
      // Open the folder
      const folderHeader = folder.querySelector('.folder-header');
      if (folderHeader) {
        console.log(`Opening folder: ${folderPath}`);
        await window.fileExplorer.toggleFolder(folderPath);
        
        // Check if any sub-folders were rendered
        const contentDiv = folder.querySelector('.folder-content');
        if (contentDiv) {
          const subFolders = contentDiv.querySelectorAll('.file-folder');
          console.log(`Found ${subFolders.length} sub-folder(s) in ${folderPath}`);
          
          if (subFolders.length > 0) {
            subfolderFound = true;
            
            // Test opening the first sub-folder
            const subFolder = subFolders[0];
            const subFolderPath = subFolder.dataset.path;
            console.log(`Testing sub-folder: ${subFolderPath}`);
            
            // Open the sub-folder
            const subFolderHeader = subFolder.querySelector('.folder-header');
            if (subFolderHeader) {
              console.log(`Opening sub-folder: ${subFolderPath}`);
              await window.fileExplorer.toggleFolder(subFolderPath);
              
              // Check if the sub-folder content is visible
              const subContentDiv = subFolder.querySelector('.folder-content');
              if (subContentDiv) {
                console.log(`Sub-folder content display: ${subContentDiv.style.display || 'not set (visible)'}`);
                console.log(`Sub-folder content children: ${subContentDiv.children.length}`);
              } else {
                console.error(`❌ Sub-folder content div not found for ${subFolderPath}`);
              }
            }
            
            break;
          }
        }
      }
    }
    
    if (!subfolderFound) {
      console.log('⚠️ No sub-folders found to test');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error testing sub-folder rendering:', error);
    return false;
  }
}

// Export functions for manual testing in the console
window.debugFolderRendering = {
  runTests,
  testFileExplorerInitialization,
  testAddFolder,
  testFolderToggling,
  testSubFolderRendering
};

console.log('Debug script loaded. You can run tests manually using window.debugFolderRendering.runTests()');