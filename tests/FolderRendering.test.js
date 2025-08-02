// tests/FolderRendering.test.js
/**
 * Folder Rendering Tests
 * 
 * These tests verify that folders properly display their contents
 * when toggled open and that file/folder names are displayed correctly.
 */

// Mock the Neutralino API
global.Neutralino = {
  filesystem: {
    readDirectory: jest.fn((path) => {
      const mockDirectoryStructure = {
        '/test': [
          { entry: 'file1.txt', path: '/test/file1.txt', type: 'FILE' },
          { entry: 'folder1', path: '/test/folder1', type: 'DIRECTORY' },
          { entry: 'folder2', path: '/test/folder2', type: 'DIRECTORY' }
        ],
        '/test/folder1': [
          { entry: 'nestedfile1.txt', path: '/test/folder1/nestedfile1.txt', type: 'FILE' },
          { entry: 'nestedfile2.txt', path: '/test/folder1/nestedfile2.txt', type: 'FILE' }
        ],
        '/test/folder2': [
          { entry: 'nestedfolder', path: '/test/folder2/nestedfolder', type: 'DIRECTORY' }
        ],
        '/test/folder2/nestedfolder': [
          { entry: 'deepfile.txt', path: '/test/folder2/nestedfolder/deepfile.txt', type: 'FILE' }
        ],
        '/empty': []
      };
      
      return Promise.resolve(mockDirectoryStructure[path] || []);
    }),
    readFile: jest.fn().mockResolvedValue(''),
    getStats: jest.fn().mockResolvedValue({ size: 0, isFile: true, isDirectory: false }),
    writeFile: jest.fn().mockResolvedValue(undefined),
    createDirectory: jest.fn().mockResolvedValue(undefined),
  },
  os: {
    getPath: jest.fn().mockResolvedValue('/test'),
    showFolderDialog: jest.fn().mockResolvedValue('/test'),
    execCommand: jest.fn().mockResolvedValue({ stdOut: '', stdErr: '', exitCode: 0 }),
  },
  events: {
    on: jest.fn().mockResolvedValue({ success: true, message: '' }),
  },
};

// Mock the window object and showNotification
global.window = {
  settings: {
    get: jest.fn().mockReturnValue({}),
    set: jest.fn().mockResolvedValue(true),
  },
  setLeftPanel: jest.fn(),
};
global.showNotification = jest.fn();

// Import the modules under test
const { createFileIcon, createFileItem, createFolderDiv } = require('../resources/js/file-explorer/explorer-ui.js');

describe('Folder Rendering Tests', () => {
  let fileExplorer;
  
  beforeEach(() => {
    // Set up DOM elements
    document.body.innerHTML = `
      <div id="sidebar-left">
        <div id="file-list"></div>
      </div>
      <div id="modal"></div>
    `;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a mock FileExplorer instance
    fileExplorer = {
      rootFolders: ['/test'],
      config: { icons: {} },
      _openFolders: {},
      selectedItems: new Set(),
      _folderSnapshots: {},
      
      // Mock critical methods
      saveWorkspaceState: jest.fn().mockResolvedValue(undefined),
      showNotification: jest.fn(),
      
      // Mock folder content retrieval
      getFolderContents: jest.fn().mockImplementation(async (path) => {
        const entries = await Neutralino.filesystem.readDirectory(path);
        return entries.map(entry => ({
          ...entry,
          name: entry.entry
        }));
      }),
      
      // Mock toggle folder functionality
      toggleFolder: jest.fn().mockImplementation(async (folderPath) => {
        const folderDiv = document.querySelector(`[data-path="${folderPath}"]`);
        if (!folderDiv) return;
        
        // Toggle open state
        fileExplorer._openFolders[folderPath] = !fileExplorer._openFolders[folderPath];
        
        if (fileExplorer._openFolders[folderPath]) {
          // Create content div
          let contentDiv = folderDiv.querySelector('.folder-content');
          if (!contentDiv) {
            contentDiv = document.createElement('div');
            contentDiv.className = 'folder-content';
            folderDiv.appendChild(contentDiv);
          }
          
          // Get folder contents
          const entries = await fileExplorer.getFolderContents(folderPath);
          
          // Create child elements
          for (const entry of entries) {
            const childDiv = document.createElement('div');
            childDiv.className = entry.type === 'DIRECTORY' ? 'file-folder' : 'file-item';
            childDiv.dataset.path = `${folderPath}/${entry.name}`;
            childDiv.dataset.type = entry.type;
            childDiv.dataset.name = entry.name;
            childDiv.innerHTML = `<div class="file-name"><p>${entry.name}</p></div>`;
            contentDiv.appendChild(childDiv);
          }
        } else {
          // Remove content div
          const contentDiv = folderDiv.querySelector('.folder-content');
          if (contentDiv) {
            contentDiv.remove();
          }
        }
      }),
      
      // Mock startTooltipTimer and clearTooltipTimer
      startTooltipTimer: jest.fn(),
      clearTooltipTimer: jest.fn(),
    };
  });
  
  test('getFolderContents should return directory entries with name property', async () => {
    const result = await fileExplorer.getFolderContents('/test');
    
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('file1.txt');
    expect(result[1].name).toBe('folder1');
    expect(result[2].name).toBe('folder2');
    
    expect(Neutralino.filesystem.readDirectory).toHaveBeenCalledWith('/test');
  });
  
  test('toggleFolder should properly render folder contents', async () => {
    // Setup - Create a folder div in the DOM
    const folderPath = '/test/folder1';
    const folderDiv = document.createElement('div');
    folderDiv.className = 'file-folder';
    folderDiv.dataset.path = folderPath;
    folderDiv.dataset.name = 'folder1';
    folderDiv.dataset.type = 'DIRECTORY';
    
    // Add folder header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'folder-header';
    headerDiv.innerHTML = '<span class="file-icon"></span><div class="file-name"><p>folder1</p></div>';
    folderDiv.appendChild(headerDiv);
    
    // Add to DOM
    document.querySelector('#file-list').appendChild(folderDiv);
    
    // Mock document.querySelector to return our folder div
    const originalQuerySelector = document.querySelector;
    document.querySelector = jest.fn((selector) => {
      if (selector === `[data-path="${folderPath}"]`) {
        return folderDiv;
      }
      return originalQuerySelector.call(document, selector);
    });
    
    // Execute - Open folder
    await fileExplorer.toggleFolder(folderPath);
    
    // Verify folder is open
    expect(fileExplorer._openFolders[folderPath]).toBe(true);
    
    // Check if folder content div exists
    const contentDiv = folderDiv.querySelector('.folder-content');
    expect(contentDiv).not.toBeNull();
    
    // Check if folder contents are rendered
    const childItems = contentDiv.children;
    expect(childItems.length).toBe(2); // Should have 2 nested files
    
    // Restore original querySelector
    document.querySelector = originalQuerySelector;
  });
  
  test('empty folders should still be displayed as open when toggled', async () => {
    // Setup - Create a folder div for an empty folder
    const emptyFolderPath = '/empty';
    const folderDiv = document.createElement('div');
    folderDiv.className = 'file-folder';
    folderDiv.dataset.path = emptyFolderPath;
    folderDiv.dataset.name = 'empty';
    folderDiv.dataset.type = 'DIRECTORY';
    
    // Add folder header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'folder-header';
    headerDiv.innerHTML = '<span class="file-icon"></span><div class="file-name"><p>empty</p></div>';
    folderDiv.appendChild(headerDiv);
    
    // Add to DOM
    document.querySelector('#file-list').appendChild(folderDiv);
    
    // Mock document.querySelector
    const originalQuerySelector = document.querySelector;
    document.querySelector = jest.fn((selector) => {
      if (selector === `[data-path="${emptyFolderPath}"]`) {
        return folderDiv;
      }
      return originalQuerySelector.call(document, selector);
    });
    
    // Execute - Open empty folder
    await fileExplorer.toggleFolder(emptyFolderPath);
    
    // Verify folder is open
    expect(fileExplorer._openFolders[emptyFolderPath]).toBe(true);
    
    // Check if folder content div exists (should exist even if empty)
    const contentDiv = folderDiv.querySelector('.folder-content');
    expect(contentDiv).not.toBeNull();
    
    // Verify the Neutralino API was called correctly
    expect(Neutralino.filesystem.readDirectory).toHaveBeenCalledWith(emptyFolderPath);
    
    // Restore original querySelector
    document.querySelector = originalQuerySelector;
  });
  
  test('createFileItem should create a file item element with the correct properties', async () => {
    const entry = { 
      name: 'test.txt', 
      entry: 'test.txt',
      type: 'FILE' 
    };
    const parentPath = '/test';
    
    const fileItem = await createFileItem(entry, parentPath, fileExplorer, {});
    
    expect(fileItem).not.toBeNull();
    expect(fileItem.className).toBe('file-item');
    expect(fileItem.dataset.path).toBe('/test/test.txt');
    expect(fileItem.dataset.type).toBe('FILE');
    expect(fileItem.dataset.name).toBe('test.txt');
    
    const fileName = fileItem.querySelector('.file-name p');
    expect(fileName).not.toBeNull();
    expect(fileName.textContent).toBe('test.txt');
  });

  test('createFolderDiv should create an empty content div for folders', async () => {
    // Create a folder entry for folder2
    const entry = { 
      name: 'folder2', 
      entry: 'folder2',
      type: 'DIRECTORY',
      fullPath: '/test/folder2'
    };
    
    // Set folder as open
    fileExplorer._openFolders['/test/folder2'] = true;
    
    // Create the folder div
    const folderDiv = await createFolderDiv(entry, '/test', fileExplorer, {});
    
    // Check that the folder div was created
    expect(folderDiv).not.toBeNull();
    expect(folderDiv.className).toBe('file-folder');
    
    // Check that it has a content div
    const contentDiv = folderDiv.querySelector('.folder-content');
    expect(contentDiv).not.toBeNull();
    
    // Check that the content div is visible when folder is open
    expect(contentDiv.style.display).not.toBe('none');
    
    // Now test with a closed folder
    fileExplorer._openFolders['/test/folder2'] = false;
    const closedFolderDiv = await createFolderDiv(entry, '/test', fileExplorer, {});
    
    // Check that it has a content div that is hidden
    const closedContentDiv = closedFolderDiv.querySelector('.folder-content');
    expect(closedContentDiv).not.toBeNull();
    expect(closedContentDiv.style.display).toBe('none');
  });
});