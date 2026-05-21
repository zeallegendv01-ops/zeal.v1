const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting 365extra Backend...\n');

// Start server
const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// Start bot
const bot = spawn('node', ['bot.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n⛔ Shutting down...');
  server.kill('SIGINT');
  bot.kill('SIGINT');
  process.exit(0);
});

server.on('error', (err) => console.error('Server error:', err));
bot.on('error', (err) => console.error('Bot error:', err));

server.on('exit', (code) => console.log('Server exited with code:', code));
bot.on('exit', (code) => console.log('Bot exited with code:', code));

