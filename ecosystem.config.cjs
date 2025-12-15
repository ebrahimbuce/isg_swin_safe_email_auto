module.exports = {
  apps: [{
    name: 'swim-safe-pr',
    script: 'dist/main.js',
    cwd: '$APP_DIR',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '400M',
    node_args: '--max-old-space-size=256',
    env: {
      NODE_ENV: 'production',
    },
    error_file: '/dev/null',
    out_file: '/dev/null',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    exp_backoff_restart_delay: 300
  }]
};