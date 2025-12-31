'use strict';

const { LocalChain } = require('../lib/chain.js');
const { Storage } = require('../lib/storage.js');
const { loadKeys } = require('../lib/keys.js');
const { ChatAgent } = require('../smart-contracts/chat.js');

/**
 * Example: AI Agent Chat System
 *
 * Demonstrates:
 * 1. Creating conversation threads
 * 2. Sending messages (user and assistant)
 * 3. Updating conversation context
 * 4. Retrieving conversation history
 * 5. Consistency validation
 */

const main = async () => {
  console.log('🤖 Initializing AI Agent Chat System...\n');

  // Initialize storage
  const keys = await loadKeys('./keys');
  const chain = await new LocalChain('./localchain');
  const storage = await new Storage('./storage', chain, keys);

  // Create chat agent
  const chatAgent = new ChatAgent({ storage, chain });
  await chatAgent.initialize();
  console.log('✅ Chat agent initialized\n');

  const userId = 'user-123';
  const agentId = 'agent-ai-001';

  // Create a new conversation thread
  console.log('💬 Creating conversation thread...');
  const thread = await chatAgent.createThread(userId, {
    agent: agentId,
    model: 'gpt-4',
    temperature: 0.7,
    preferences: {
      language: 'en',
      tone: 'professional',
    },
  });
  console.log(`   Thread ID: ${thread.threadId}\n`);

  // User sends first message
  console.log('👤 User message:');
  const userMsg1 = await chatAgent.sendMessage(
    thread.threadId,
    userId,
    'user',
    'Hello! I need help with my project.',
  );
  console.log(`   Message ID: ${userMsg1.message.id}`);
  console.log(`   Content: ${userMsg1.message.content}`);
  console.log(`   Timestamp: ${new Date(userMsg1.message.timestamp).toISOString()}\n`);

  // Agent responds
  console.log('🤖 Agent response:');
  const agentMsg1 = await chatAgent.sendMessage(
    thread.threadId,
    userId,
    'assistant',
    "Hello! I'd be happy to help you with your project. Could you tell me more about what you're working on?",
    {
      model: 'gpt-4',
      tokens: 25,
      confidence: 0.95,
    },
  );
  console.log(`   Message ID: ${agentMsg1.message.id}`);
  console.log(`   Content: ${agentMsg1.message.content}`);
  console.log(`   Metadata: ${JSON.stringify(agentMsg1.message.metadata)}\n`);

  // User continues conversation
  console.log('👤 User message:');
  const userMsg2 = await chatAgent.sendMessage(
    thread.threadId,
    userId,
    'user',
    "I'm building a blockchain-based storage system using JavaScript.",
  );
  console.log(`   Content: ${userMsg2.message.content}\n`);

  // Update context with new information
  console.log('📝 Updating conversation context...');
  await chatAgent.updateContext(thread.threadId, userId, {
    project: {
      type: 'blockchain',
      language: 'javascript',
      domain: 'storage',
    },
    conversation: {
      topic: 'blockchain storage',
      stage: 'planning',
    },
  });
  console.log('   Context updated\n');

  // Agent responds with context awareness
  console.log('🤖 Agent response (with context):');
  const agentMsg2 = await chatAgent.sendMessage(
    thread.threadId,
    userId,
    'assistant',
    'That sounds interesting! For a blockchain-based storage system in JavaScript, you might want to consider using a local chain for integrity, smart contracts for business logic, and encrypted storage for sensitive data. Would you like me to help you design the architecture?',
    {
      model: 'gpt-4',
      tokens: 45,
      confidence: 0.92,
      usedContext: true,
    },
  );
  console.log(`   Content: ${agentMsg2.message.content}\n`);

  // Retrieve full conversation
  console.log('📜 Retrieving conversation history:');
  const conversation = await chatAgent.getConversation(thread.threadId, userId);
  console.log(`   Thread ID: ${conversation.threadId}`);
  console.log(`   Total messages: ${conversation.messageCount}`);
  console.log(`   Context: ${JSON.stringify(conversation.context, null, 2)}`);
  console.log('\n   Messages:');
  conversation.messages.forEach((msg, idx) => {
    const role = msg.role === 'user' ? '👤' : '🤖';
    console.log(
      `   ${idx + 1}. ${role} [${msg.role}]: ${msg.content.substring(0, 60)}...`,
    );
  });

  // Get thread metadata
  console.log('\n📊 Thread metadata:');
  const metadata = await chatAgent.getThreadMetadata(thread.threadId, userId);
  console.log(`   Created: ${new Date(metadata.createdAt).toISOString()}`);
  console.log(`   Updated: ${new Date(metadata.updatedAt).toISOString()}`);
  console.log(`   Messages: ${metadata.messageCount}`);

  // Get user's all threads
  console.log('\n📚 User threads:');
  const userThreads = await chatAgent.getUserThreads(userId);
  console.log(`   Total threads: ${userThreads.length}`);
  console.log(`   Thread IDs: ${userThreads.join(', ')}`);

  // Validate chain integrity
  const isValid = await chain.isValid();
  console.log(`\n🕵️  Blockchain valid: ${isValid}`);
};

main().catch(console.error);

