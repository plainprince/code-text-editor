// Language Server Manager - Simplified version that provides server configurations
// Based on https://microsoft.github.io/language-server-protocol/implementors/servers/

class LanguageServerManager {
  constructor() {
    this.serverConfigs = new Map();
    
    // Load language server configurations
    this.initializeLanguageServers();
  }
  
  // Initialize language server configurations based on Microsoft's LSP implementors list
  initializeLanguageServers() {
    const serverConfigs = [
      // TypeScript/JavaScript - Multiple options available
      {
        languages: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
        name: 'typescript-language-server',
        command: 'typescript-language-server',
        args: ['--stdio'],
        npmPackage: 'typescript-language-server',
        repository: 'https://github.com/typescript-language-server/typescript-language-server',
        maintainer: 'TypeScript Community'
      },
      
      // Python - Multiple implementations
      {
        languages: ['python'],
        name: 'pylsp',
        command: 'pylsp',
        args: [],
        npmPackage: null,
        pipPackage: 'python-lsp-server',
        repository: 'https://github.com/python-lsp/python-lsp-server',
        maintainer: 'Python LSP Community'
      },
      {
        languages: ['python'],
        name: 'pyright',
        command: 'pyright-langserver',
        args: ['--stdio'],
        npmPackage: 'pyright',
        repository: 'https://github.com/microsoft/pyright',
        maintainer: 'Microsoft'
      },
      
      // Rust
      {
        languages: ['rust'],
        name: 'rust-analyzer',
        command: 'rust-analyzer',
        args: [],
        repository: 'https://github.com/rust-lang/rust-analyzer',
        maintainer: 'Rust Language Team'
      },
      
      // Go
      {
        languages: ['go'],
        name: 'gopls',
        command: 'gopls',
        args: [],
        repository: 'https://github.com/golang/tools/tree/master/gopls',
        maintainer: 'Go Team'
      },
      
      // Java
      {
        languages: ['java'],
        name: 'eclipse-jdt-ls',
        command: 'jdtls',
        args: [],
        repository: 'https://github.com/eclipse/eclipse.jdt.ls',
        maintainer: 'Eclipse JDT'
      },
      
      // C/C++
      {
        languages: ['c', 'cpp'],
        name: 'clangd',
        command: 'clangd',
        args: [],
        repository: 'https://github.com/clangd/clangd',
        maintainer: 'LLVM Project'
      },
      
      // C#
      {
        languages: ['csharp'],
        name: 'omnisharp',
        command: 'OmniSharp',
        args: ['--languageserver'],
        repository: 'https://github.com/OmniSharp/omnisharp-roslyn',
        maintainer: 'OmniSharp'
      },
      
      // PHP
      {
        languages: ['php'],
        name: 'intelephense',
        command: 'intelephense',
        args: ['--stdio'],
        npmPackage: 'intelephense',
        repository: 'https://github.com/bmewburn/vscode-intelephense',
        maintainer: 'Ben Mewburn'
      },
      
      // Ruby
      {
        languages: ['ruby'],
        name: 'solargraph',
        command: 'solargraph',
        args: ['stdio'],
        repository: 'https://github.com/castwide/solargraph',
        maintainer: 'Castwide'
      },
      
      // Vue.js
      {
        languages: ['vue'],
        name: 'vls',
        command: 'vls',
        args: [],
        npmPackage: 'vls',
        repository: 'https://github.com/vuejs/vetur',
        maintainer: 'Vue Team'
      },
      
      // HTML/CSS
      {
        languages: ['html'],
        name: 'html-languageserver',
        command: 'html-languageserver',
        args: ['--stdio'],
        npmPackage: 'vscode-html-languageserver-bin',
        repository: 'https://github.com/Microsoft/vscode/tree/main/extensions/html-language-features/server',
        maintainer: 'Microsoft'
      },
      {
        languages: ['css', 'scss', 'less'],
        name: 'css-languageserver',
        command: 'css-languageserver',
        args: ['--stdio'],
        npmPackage: 'vscode-css-languageserver-bin',
        repository: 'https://github.com/Microsoft/vscode/tree/main/extensions/css-language-features/server',
        maintainer: 'Microsoft'
      },
      
      // JSON
      {
        languages: ['json', 'jsonc'],
        name: 'json-languageserver',
        command: 'json-languageserver',
        args: ['--stdio'],
        npmPackage: 'vscode-json-languageserver-bin',
        repository: 'https://github.com/Microsoft/vscode/tree/main/extensions/json-language-features/server',
        maintainer: 'Microsoft'
      },
      
      // YAML
      {
        languages: ['yaml'],
        name: 'yaml-language-server',
        command: 'yaml-language-server',
        args: ['--stdio'],
        npmPackage: 'yaml-language-server',
        repository: 'https://github.com/redhat-developer/yaml-language-server',
        maintainer: 'Red Hat Developers'
      },
      
      // XML
      {
        languages: ['xml'],
        name: 'lemminx',
        command: 'lemminx',
        args: [],
        repository: 'https://github.com/eclipse/lemminx',
        maintainer: 'Eclipse'
      },
      
      // Bash
      {
        languages: ['shellscript', 'bash'],
        name: 'bash-language-server',
        command: 'bash-language-server',
        args: ['start'],
        npmPackage: 'bash-language-server',
        repository: 'https://github.com/mads-hartmann/bash-language-server',
        maintainer: 'Mads Hartmann'
      },
      
      // Docker
      {
        languages: ['dockerfile'],
        name: 'docker-langserver',
        command: 'docker-langserver',
        args: ['--stdio'],
        npmPackage: 'dockerfile-language-server-nodejs',
        repository: 'https://github.com/rcjsuen/dockerfile-language-server-nodejs',
        maintainer: 'Remy Suen'
      }
    ];
    
    // Store configurations by language
    serverConfigs.forEach(config => {
      config.languages.forEach(lang => {
        if (!this.serverConfigs.has(lang)) {
          this.serverConfigs.set(lang, []);
        }
        this.serverConfigs.get(lang).push(config);
      });
    });
    
    console.log('Language server configurations loaded:', this.serverConfigs);
  }
  
  // Get server configurations for a language
  getServerConfigs(languageId) {
    return this.serverConfigs.get(languageId) || [];
  }
  
  // Get all available language servers for a language
  getAvailableServers(languageId) {
    return this.serverConfigs.get(languageId) || [];
  }
}

export default LanguageServerManager;