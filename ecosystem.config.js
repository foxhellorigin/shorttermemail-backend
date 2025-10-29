export default {
  apps: [{
    name: 'shorttermemail-web',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/web-error.log',
    out_file: './logs/web-out.log',
    log_file: './logs/web-combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    watch: false,
    ignore_watch: [
      'node_modules',
      'logs',
      '.git'
    ],
    instance_var: 'INSTANCE_ID',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }, {
    name: 'shorttermemail-smtp',
    script: './smtp-server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: './logs/smtp-error.log',
    out_file: './logs/smtp-out.log',
    log_file: './logs/smtp-combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '512M',
    watch: false,
    ignore_watch: [
      'node_modules',
      'logs',
      '.git'
    ],
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }],

  // Deployment configuration
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/shorttermemail-api.git',
      path: '/var/www/shorttermemail-api',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt-get install git && npm install -g pm2'
    }
  }
};