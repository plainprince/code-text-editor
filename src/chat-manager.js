import { marked } from 'marked';
import { Modal } from './modal.js';
import { AITools } from './ai-tools.js';
import OpenAI from 'openai';

export class ChatManager {
  constructor(chatHistoryId, aiPanel) {
    this.chatHistory = document.getElementById(chatHistoryId);
    this.aiPanel = aiPanel;
    this.messages = [];
    
    // Initialize OpenAI client for Ollama
    this.openai = new OpenAI({
      apiKey: 'ollama', // Required but ignored by Ollama
      baseURL: 'http://localhost:11434/v1', // Ollama's OpenAI-compatible endpoint
      dangerouslyAllowBrowser: true // Required for browser usage
    });
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
    
    this.messages.push({ role: 'user', content });
    
    const assistantMessageContainer = this.addMessage('', 'assistant');

    try {
      // Use OpenAI client with streaming
      const stream = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: this.messages,
        stream: true,
        temperature: 0.7,
      });

      let assistantResponse = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          assistantResponse += content;
          // Update the message container with the current response
          assistantMessageContainer.innerHTML = marked.parse(assistantResponse);
          
          // Auto-scroll to bottom
          this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
        }
      }
      
      this.messages.push({ role: 'assistant', content: assistantResponse });
      this.handleToolCalls(assistantResponse);

    } catch (error) {
      console.error('Error communicating with Ollama:', error);
      assistantMessageContainer.innerHTML = 'Sorry, I encountered an error. Please make sure Ollama is running and accessible at http://localhost:11434.';
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
    messageElement.className = `chat-message ${role}`;
    messageElement.innerHTML = marked.parse(content);
    this.chatHistory.appendChild(messageElement);
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    return messageElement;
  }

  handleToolCalls(response) {
    const toolCallRegex = /```json\n([\s\S]*?)\n```|({[\s\S]*?})/;
    const match = response.match(toolCallRegex);

    if (match) {
      const jsonString = match[1] || match[2];
      try {
        const toolCall = JSON.parse(jsonString);
        if (toolCall.tool && AITools[toolCall.tool]) {
          this.executeTool(toolCall.tool, toolCall.params);
        }
      } catch (error) {
        console.error('Error parsing tool call:', error);
      }
    }
  }

  async executeTool(toolName, params) {
    const result = await AITools[toolName](params);
    const systemMessage = `Tool ${toolName} executed with result: ${JSON.stringify(result)}`;
    this.messages.push({ role: 'system', content: systemMessage });
  }
}
