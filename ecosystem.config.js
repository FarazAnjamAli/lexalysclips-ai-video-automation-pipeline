// PM2 process config — `pm2 start ecosystem.config.js` then `pm2 save`.
// Runs FARAZ Studio always-on at http://localhost:4545 (no .bat needed).
module.exports = {
  apps: [{
    name: 'faraz-studio',
    script: 'server.js',
    cwd: __dirname,
    env: { PORT: 4545 },
    autorestart: true,
    max_restarts: 10,
    watch: false,
    max_memory_restart: '1500M',
    out_file: 'data/tmp/pm2-out.log',
    error_file: 'data/tmp/pm2-err.log',
    merge_logs: true,
    time: true,
  }],
};
