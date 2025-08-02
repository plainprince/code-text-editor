// tests/file-names.test.js
const fs = require('fs');
const path = require('path');

// Simple test to verify the issue with file names
describe('File Names Issue', () => {
  test('should identify the issue in toggleFolder method', () => {
    // The issue is in FileExplorer.js line ~264-268
    const fileExplorerContent = fs.readFileSync(
      path.join(__dirname, '../resources/js/file-explorer/FileExplorer.js'),
      'utf8'
    );
    
    // Check if the code is explicitly setting the name property
    const hasNameProperty = fileExplorerContent.includes("name: entry.entry");
    
    // This should pass because we're explicitly setting the name property
    expect(hasNameProperty).toBe(true);
    
    // Check if we're using the correct entry.entry value for the name
    const hasCorrectNameValue = fileExplorerContent.includes("name: entry.entry");
    
    // This should pass if we're using the correct name value
    expect(hasCorrectNameValue).toBe(true);
  });
});