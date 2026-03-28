// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'felbo-api',
      script: 'dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      merge_logs: true,
    },
    {
      name: 'felbo-worker-notifications',
      script: 'dist/shared/notification/notification.worker.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      kill_timeout: 10000,
      max_memory_restart: '300M',
      error_file: 'logs/worker-error.log',
      out_file: 'logs/worker-out.log',
    },
  ],
};
