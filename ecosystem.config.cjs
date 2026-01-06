module.exports = {
  apps: [
    {
      name: 'swim-safe-pr',
      script: 'dist/main.js',
      cwd: '/home/ubuntu/isg_swin_safe_email_auto',
      instances: 'max', // Usa todos los núcleos del CPU
      exec_mode: 'cluster', // Habilita balanceo de carga
      autorestart: true,
      watch: false,
      max_memory_restart: '550M', // Reiniciar si excede 500MB
      node_args: '--max-old-space-size=350', // Límite de heap de Node.js
      env: {
        NODE_ENV: 'production',
      },
      // Logs
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart policy
      exp_backoff_restart_delay: 100,
    },
  ],
};
