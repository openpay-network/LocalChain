'use strict';

const { SmartContract } = require('../lib/contract.js');

/**
 * AI Agent Chat System
 *
 * Implements a chat system for AI agents with:
 * - Conversation thread management
 * - Message storage with timestamps
 * - User context persistence
 * - Conversation history retrieval
 * - Message consistency validation
 */

class ChatAgent {
  #storage;
  #chain;
  #sendMessageContract;
  #updateContextContract;
  #getConversationContract;

  constructor({ storage, chain }) {
    this.#storage = storage;
    this.#chain = chain;
  }

  async initialize() {
    const storage = this.#storage;
    const chain = this.#chain;

    // Send message contract: handles both user and agent messages
    const sendMessageProc = async (reader, args) => {
      const { threadId, userId, role, content, metadata = {} } = args;

      if (!threadId || !userId || !role || !content) {
        throw new Error('Missing required fields: threadId, userId, role, content');
      }

      if (!['user', 'assistant', 'system'].includes(role)) {
        throw new Error('Invalid role. Must be: user, assistant, or system');
      }

      // Get conversation thread
      const thread = (await reader.get(`thread:${threadId}`)) || {
        threadId,
        userId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        context: {},
      };

      // Validate thread belongs to user
      if (thread.userId !== userId) {
        throw new Error('Thread does not belong to this user');
      }

      // Create message
      const message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        threadId,
        role,
        content,
        timestamp: Date.now(),
        metadata,
      };

      // Add message to thread
      thread.messages.push(message);
      thread.updatedAt = Date.now();

      // Save updated thread
      await storage.saveData(`thread:${threadId}`, thread);

      // Update user's thread list
      const userThreads =
        (await reader.get(`user:${userId}:threads`)) || { threads: [] };
      if (!userThreads.threads.includes(threadId)) {
        userThreads.threads.push(threadId);
        await storage.saveData(`user:${userId}:threads`, userThreads);
      }

      // Log message to blockchain
      await chain.addBlock({
        type: 'chat-message',
        threadId,
        userId,
        messageId: message.id,
        role,
        timestamp: message.timestamp,
      });

      return {
        success: true,
        message,
        threadId,
        messageCount: thread.messages.length,
      };
    };

    this.#sendMessageContract = new SmartContract('chat-send-message', sendMessageProc, {
      storage: this.#storage,
      chain: this.#chain,
    });

    // Update context contract: stores/updates conversation context
    const updateContextProc = async (reader, args) => {
      const { threadId, userId, context } = args;

      if (!threadId || !userId || !context) {
        throw new Error('Missing required fields: threadId, userId, context');
      }

      // Get conversation thread
      const thread = (await reader.get(`thread:${threadId}`)) || {
        threadId,
        userId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        context: {},
      };

      // Validate thread belongs to user
      if (thread.userId !== userId) {
        throw new Error('Thread does not belong to this user');
      }

      // Merge context (deep merge for nested objects)
      const mergeContext = (target, source) => {
        for (const key in source) {
          if (
            typeof source[key] === 'object' &&
            source[key] !== null &&
            !Array.isArray(source[key]) &&
            typeof target[key] === 'object' &&
            target[key] !== null &&
            !Array.isArray(target[key])
          ) {
            target[key] = mergeContext({ ...target[key] }, source[key]);
          } else {
            target[key] = source[key];
          }
        }
        return target;
      };

      thread.context = mergeContext(thread.context || {}, context);
      thread.updatedAt = Date.now();

      // Save updated thread
      await storage.saveData(`thread:${threadId}`, thread);

      // Log context update
      await chain.addBlock({
        type: 'chat-context-update',
        threadId,
        userId,
        timestamp: Date.now(),
      });

      return {
        success: true,
        threadId,
        context: thread.context,
      };
    };

    this.#updateContextContract = new SmartContract(
      'chat-update-context',
      updateContextProc,
      { storage: this.#storage, chain: this.#chain },
    );

    // Get conversation contract: retrieves conversation with consistency check
    const getConversationProc = async (reader, args) => {
      const { threadId, userId, limit } = args;

      if (!threadId || !userId) {
        throw new Error('Missing required fields: threadId, userId');
      }

      // Get conversation thread
      const thread = await reader.get(`thread:${threadId}`);

      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }

      // Validate thread belongs to user
      if (thread.userId !== userId) {
        throw new Error('Thread does not belong to this user');
      }

      // Validate message consistency
      const messages = thread.messages || [];
      const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

      // Check for gaps or duplicates
      const messageIds = new Set();
      for (const msg of sortedMessages) {
        if (messageIds.has(msg.id)) {
          throw new Error(`Duplicate message ID found: ${msg.id}`);
        }
        messageIds.add(msg.id);
        if (!msg.timestamp || !msg.role || !msg.content) {
          throw new Error(`Invalid message format: ${msg.id}`);
        }
      }

      // Apply limit if specified
      const limitedMessages = limit
        ? sortedMessages.slice(-limit)
        : sortedMessages;

      return {
        threadId,
        userId,
        messages: limitedMessages,
        context: thread.context || {},
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        messageCount: messages.length,
        totalMessages: messages.length,
      };
    };

    this.#getConversationContract = new SmartContract(
      'chat-get-conversation',
      getConversationProc,
      { storage: this.#storage, chain: this.#chain },
    );
  }

  /**
   * Send a message in a conversation thread
   */
  async sendMessage(threadId, userId, role, content, metadata = {}) {
    return this.#sendMessageContract.execute({
      id: `send-${Date.now()}`,
      threadId,
      userId,
      role,
      content,
      metadata,
    });
  }

  /**
   * Update conversation context
   */
  async updateContext(threadId, userId, context) {
    return this.#updateContextContract.execute({
      id: `context-${Date.now()}`,
      threadId,
      userId,
      context,
    });
  }

  /**
   * Get conversation with consistency validation
   */
  async getConversation(threadId, userId, limit = null) {
    return this.#getConversationContract.execute({
      id: `get-${Date.now()}`,
      threadId,
      userId,
      limit,
    });
  }

  /**
   * Create a new conversation thread
   */
  async createThread(userId, initialContext = {}) {
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Initialize thread with system message if needed
    if (Object.keys(initialContext).length > 0) {
      await this.updateContext(threadId, userId, initialContext);
    }

    return {
      threadId,
      userId,
      createdAt: Date.now(),
    };
  }

  /**
   * Get all threads for a user
   */
  async getUserThreads(userId) {
    const userThreads = await this.#storage.loadData(`user:${userId}:threads`);
    return userThreads ? userThreads.threads : [];
  }

  /**
   * Get thread metadata
   */
  async getThreadMetadata(threadId, userId) {
    const thread = await this.#storage.loadData(`thread:${threadId}`);
    if (!thread) {
      return null;
    }
    if (thread.userId !== userId) {
      throw new Error('Thread does not belong to this user');
    }
    return {
      threadId: thread.threadId,
      userId: thread.userId,
      messageCount: thread.messages ? thread.messages.length : 0,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      context: thread.context || {},
    };
  }
}

module.exports = { ChatAgent };

