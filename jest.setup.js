// jest.setup.js
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

global.Neutralino = {
  init: jest.fn(),
  filesystem: {
    readDirectory: jest.fn(),
    readFile: jest.fn(),
    getStats: jest.fn(),
    writeFile: jest.fn(),
    createDirectory: jest.fn(),
  },
  os: {
    getPath: jest.fn(),
    showFolderDialog: jest.fn(),
    execCommand: jest.fn(),
  },
  events: {
    on: jest.fn(),
  },
};

global.NL_OS = 'Darwin';

// Mock document
document.body.innerHTML = `
  <div id="sidebar-left">
    <div id="file-list"></div>
  </div>
`;

// Mock window.settings
global.window = {
  settings: {
    get: jest.fn(),
    set: jest.fn(),
  },
  setLeftPanel: jest.fn(),
};

// Mock showNotification
global.showNotification = jest.fn();