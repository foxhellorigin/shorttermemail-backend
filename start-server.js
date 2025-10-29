import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start main server
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

// Start SMTP server
const smtp = spawn('node', ['smtp-server.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

server.on('error', (err) => {
  console.error('Failed to start main server:', err);
});

smtp.on('error', (err) => {
  console.error('Failed to start SMTP server:', err);
});

process.on('SIGINT', () => {
  console.log('Shutting down servers...');
  server.kill();
  smtp.kill();
  process.exit();
});