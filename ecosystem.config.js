module.exports = {
  apps: [
    {
      name: 'backend',
      script: './scripts/start_backend.sh',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-error.log',
      merge_logs: true,
      time: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
    {
      name: 'frontend',
      script: './scripts/start_frontend.sh',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-error.log',
      merge_logs: true,
      time: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
    }
  ]
};
