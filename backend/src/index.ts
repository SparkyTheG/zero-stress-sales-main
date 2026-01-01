import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { ConversationWebSocketServer } from './websocket.js';

// Load environment variables from .env file (for local development)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins (needed for WebSocket from different domains)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.OPENAI_API_KEY
  });
});

// Initialize WebSocket server
// Support multiple environment variable names for flexibility
const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.API_KEY;

if (!openaiApiKey) {
  console.error('❌ ERROR: OpenAI API key not found!');
  console.error('Please set one of these environment variables:');
  console.error('  - OPENAI_API_KEY');
  console.error('  - OPENAI_KEY'); 
  console.error('  - API_KEY');
  console.error('');
  console.error('For local development: Create backend/.env file with OPENAI_API_KEY=your_key');
  console.error('For deployment: Set the environment variable in your hosting platform');
  process.exit(1);
}

console.log('✅ OpenAI API key loaded successfully');
console.log(`📍 Server will run on port ${PORT}`);

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server (it will attach to the HTTP server)
const wsServer = new ConversationWebSocketServer(server, openaiApiKey);

// Start HTTP server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server attached and ready`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  wsServer.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  wsServer.close();
  process.exit(0);
});

