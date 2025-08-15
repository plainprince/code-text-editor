import { marked } from 'marked';
import { Modal } from './modal.js';
import { AITools } from './ai-tools.js';
import OpenAI from 'openai';

export class ChatManager {
  constructor(chatHistoryId, aiPanel) {
    this.chatHistory = document.getElementById(chatHistoryId);
    this.aiPanel = aiPanel;
    this.messages = [];
    this.maxMessages = 50; // Limit chat history to prevent memory issues
    this.isStreaming = false;
    this.currentStream = null;
    
    // Initialize OpenAI client for Ollama
    this.openai = new OpenAI({
      apiKey: 'ollama', // Required but ignored by Ollama
      baseURL: 'http://localhost:11434/v1', // Ollama's OpenAI-compatible endpoint
      dangerouslyAllowBrowser: true // Required for browser usage
    });
  }

  // Clear old messages to prevent memory buildup
  trimMessages() {
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  // Clear chat history
  clearChat() {
    this.messages = [];
    this.chatHistory.innerHTML = '';
  }

  // Process message with replacements and context files (unless max mode is enabled)
  processMessage(content) {
    // Simple string replacements
    const replacements = {
      'tho': 'though',
      'thru': 'through',
      'ur': 'your',
      'pls': 'please',
      'u': 'you'
    };
    
    let processed = content;
    
    // Apply replacements
    for (const [from, to] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${from}\\b`, 'gi');
      processed = processed.replace(regex, to);
    }
    
    // Process @file mentions to add context
    const fileRegex = /@([^\s]+)/g;
    let match;
    const contextFiles = [];
    
    while ((match = fileRegex.exec(processed)) !== null) {
      contextFiles.push(match[1]);
    }
    
    // Replace @file mentions with context
    if (contextFiles.length > 0) {
      processed = processed.replace(fileRegex, '');
      processed += '\n\nContext files referenced: ' + contextFiles.join(', ');
    }
    
    return processed;
  }

  updateSendButton() {
    const sendButton = document.getElementById('ai-send-button');
    if (sendButton) {
      if (this.isStreaming) {
        sendButton.textContent = '⏹';
        sendButton.title = 'Stop generation';
      } else {
        sendButton.textContent = '➤';
        sendButton.title = 'Send message';
      }
    }
  }

  stopStreaming() {
    this.isStreaming = false;
    if (this.currentStream && this.currentStream.controller) {
      this.currentStream.controller.abort();
    }
    this.updateSendButton();
  }

  async sendMessage(content) {
    if (!content.trim()) return;

    const snapshotId = await window.snapshotManager?.createSnapshot(`Before AI message: ${content.substring(0, 50)}...`);

    this.addUserMessage(content, snapshotId);
    
    const selectedModel = this.aiPanel.modelManager.selectedModel || this.aiPanel.modelManager.models[0]?.id;
    if (!selectedModel) {
      Modal.alert('Error', 'No model selected. Please select a model from the dropdown.');
      return;
    }
    
    // Apply message processing unless max mode is enabled
    let processedContent = content;
    if (!this.aiPanel.modelManager.maxMode) {
      processedContent = this.processMessage(content);
    }
    
    this.messages.push({ role: 'user', content: processedContent });
    
    const assistantMessageContainer = this.addMessage('', 'assistant');

    // Update send button to stop button
    this.isStreaming = true;
    this.updateSendButton();

    try {      
      // Add system message about tools if in agent mode
      const messages = [...this.messages];
      const mode = this.aiPanel.toolManager.selectedMode || 'ask';
      
      if (mode === 'agent') {
        const systemMessage = {
          role: 'system',
          content: `You are an AI assistant with access to tools. When you need to use a tool, end your response with a JSON object containing the tool name and parameters like this:

{
  "tool": "toolName",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}

Available tools:
- writeFile: Create or write to a file {"tool": "writeFile", "parameters": {"path": "filename.txt", "content": "file content"}}
- readFile: Read file contents {"tool": "readFile", "parameters": {"path": "filename.txt"}}
- runTerminalCommand: Execute a terminal command {"tool": "runTerminalCommand", "parameters": {"command": "ls -la"}}
- listFiles: List files in directory {"tool": "listFiles", "parameters": {"path": "."}}
- addTodo: Add a TODO item {"tool": "addTodo", "parameters": {"content": "Task description"}}
- getTodos: Get current TODO list {"tool": "getTodos", "parameters": {}}

Use tools to help the user with their requests.`
        };
        messages.unshift(systemMessage);
      }

      // Use OpenAI client with streaming
      this.currentStream = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: messages,
        stream: true,
        temperature: 0.7,
      });

      let assistantResponse = '';
      
      try {
        for await (const chunk of this.currentStream) {
          if (!this.isStreaming) break; // Stop if user clicked stop
          
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            assistantResponse += content;
            // Update the message container with the current response
            assistantMessageContainer.innerHTML = marked.parse(assistantResponse);
            
            // Auto-scroll to bottom
            this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
          }
        }
      } finally {
        // Ensure stream is properly closed
        if (this.currentStream && this.currentStream.controller) {
          this.currentStream.controller.abort();
        }
        this.currentStream = null;
      }
      
      if (assistantResponse) {
        this.messages.push({ role: 'assistant', content: assistantResponse });
        this.trimMessages(); // Prevent memory buildup
        this.handleToolCalls(assistantResponse);
      }

    } catch (error) {
      console.error('Error communicating with Ollama:', error.message);
      
      assistantMessageContainer.innerHTML = `Sorry, I encountered an error: ${error.message}. Please make sure Ollama is running and accessible at http://localhost:11434.`;
    } finally {
      // Reset send button
      this.isStreaming = false;
      this.updateSendButton();
    }
  }
  
  addUserMessage(content, snapshotId) {
    const messageElement = this.addMessage(content, 'user');
    if (snapshotId) {
      const restoreButton = document.createElement('button');
      restoreButton.textContent = 'Restore Checkpoint';
      restoreButton.className = 'restore-checkpoint-btn';
      restoreButton.onclick = () => window.snapshotManager.rollbackTo(snapshotId);
      messageElement.appendChild(restoreButton);
    }
  }

  addMessage(content, role) {
    const messageElement = document.createElement('div');
    messageElement.className = `ai-message ${role}`;
    messageElement.innerHTML = marked.parse(content);
    this.chatHistory.appendChild(messageElement);
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    return messageElement;
  }

  handleToolCalls(response) {
    // Look for JSON tool calls at the end of the response
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
    const inlineJsonRegex = /({[\s\S]*?})\s*$/;
    
    let match = response.match(jsonBlockRegex) || response.match(inlineJsonRegex);
    
    if (match) {
      try {
        const jsonString = match[1];
        const toolCall = JSON.parse(jsonString);
        
        if (toolCall.tool && toolCall.parameters && AITools[toolCall.tool]) {
          console.log('Executing tool:', toolCall.tool, 'with params:', toolCall.parameters);
          this.executeTool(toolCall.tool, toolCall.parameters);
        }
      } catch (error) {
        console.error('Error parsing tool call:', error, 'JSON string:', match[1]);
      }
    }
  }

  async executeTool(toolName, params) {
    try {
      console.log(`Executing tool: ${toolName}`, params);
      
      // Check if tool exists
      if (!AITools[toolName]) {
        throw new Error(`Tool ${toolName} not found`);
      }
      
      const result = await AITools[toolName](params);
      const systemMessage = `Tool ${toolName} executed successfully with result: ${JSON.stringify(result)}`;
      
      // Store system message in file
      await this.storeSystemMessage(systemMessage);
      
      // Add to messages array
      this.messages.push({ role: 'system', content: systemMessage });
      
      // Continue the conversation by sending the system message back to AI
      await this.continueConversation();
      
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      const errorMessage = `Tool ${toolName} failed with error: ${error.message}`;
      
      // Store error message
      await this.storeSystemMessage(errorMessage);
      this.messages.push({ role: 'system', content: errorMessage });
      
      // Continue conversation even after error
      await this.continueConversation();
    }
  }

  async storeSystemMessage(message) {
    try {
      const timestamp = new Date().toISOString();
      const filename = `system_message_${timestamp.replace(/[:.]/g, '-')}.txt`;
      
      if (window.__TAURI__) {
        const { writeTextFile, BaseDirectory } = window.__TAURI__.fs;
        const { appDataDir } = window.__TAURI__.path;
        
        const appDir = await appDataDir();
        const systemMessagesDir = `${appDir}/system_messages`;
        
        // Ensure directory exists
        try {
          await window.__TAURI__.core.invoke('run_command', {
            command: 'mkdir',
            args: ['-p', systemMessagesDir],
            cwd: '.'
          });
        } catch (err) {
          console.warn('Could not create system messages directory:', err);
        }
        
        // Write the message
        await writeTextFile(`system_messages/${filename}`, `${timestamp}\n\n${message}`);
        console.log(`System message stored in: ${filename}`);
      }
    } catch (error) {
      console.error('Failed to store system message:', error);
    }
  }

  async continueConversation() {
    // Continue the conversation with the updated messages
    const selectedModel = this.aiPanel.modelManager.selectedModel || this.aiPanel.modelManager.models[0]?.id;
    if (!selectedModel) return;

    const assistantMessageContainer = this.addMessage('', 'assistant');
    
    try {
      // Add system message about tools if in agent mode
      const messages = [...this.messages];
      const mode = this.aiPanel.toolManager.selectedMode || 'agent';
      
      if (mode === 'agent') {
        const systemMessage = {
          role: 'system',
          content: `You are an AI assistant with access to tools. The previous tool execution result is now available in your context. Continue the conversation naturally, acknowledging the tool result and helping the user with their request.

Available tools (use when needed):
- writeFile: Create or write to a file {"tool": "writeFile", "parameters": {"path": "filename.txt", "content": "file content"}}
- readFile: Read file contents {"tool": "readFile", "parameters": {"path": "filename.txt"}}
- runTerminalCommand: Execute a terminal command {"tool": "runTerminalCommand", "parameters": {"command": "ls -la"}}
- listFiles: List files in directory {"tool": "listFiles", "parameters": {"path": "."}}
- addTodo: Add a TODO item {"tool": "addTodo", "parameters": {"content": "Task description"}}
- getTodos: Get current TODO list {"tool": "getTodos", "parameters": {}}

To use a tool, end your response with a JSON object like: {"tool": "toolName", "parameters": {...}}`
        };
        messages.unshift(systemMessage);
      }

      // Use OpenAI client with streaming
      this.currentStream = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: messages,
        stream: true,
        temperature: 0.7,
      });

      let assistantResponse = '';
      
      try {
        for await (const chunk of this.currentStream) {
          if (!this.isStreaming) break;
          
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            assistantResponse += content;
            assistantMessageContainer.innerHTML = marked.parse(assistantResponse);
            this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
          }
        }
      } finally {
        if (this.currentStream && this.currentStream.controller) {
          this.currentStream.controller.abort();
        }
        this.currentStream = null;
      }
      
      if (assistantResponse) {
        this.messages.push({ role: 'assistant', content: assistantResponse });
        this.trimMessages();
        this.handleToolCalls(assistantResponse);
      }

    } catch (error) {
      console.error('Error in continued conversation:', error.message);
      assistantMessageContainer.innerHTML = `Error continuing conversation: ${error.message}`;
    }
  }
}
