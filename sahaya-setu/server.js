const http = require('http');
const app = require('./server/app');
const env = require('./server/config/env');
const { connectDB } = require('./server/config/db');
const services = require('./server/services/services');
const { initSocket } = require('./server/services/socket');

let escalationTimer = null;

function startEscalationLoop(intervalSeconds) {
  if (intervalSeconds <= 0) return;
  escalationTimer = setInterval(async () => {
    try {
      const done = await services.runEscalations();
      if (done && done.length > 0) {
        console.log(`Escalated overdue tickets: ${done.join(', ')}`);
      }
    } catch (err) {
      console.error('Escalation job failed:', err);
    }
  }, intervalSeconds * 1000);
}

async function start() {
  try {
    await connectDB();
    startEscalationLoop(env.ESCALATION_INTERVAL_S);

    const server = http.createServer(app);
    initSocket(server);

    server.listen(env.PORT, () => {
      console.log(`Sahaya Setu Smart Civic Response Server running on http://localhost:${env.PORT}`);
    });

    const shutdown = async () => {
      console.log('Shutting down...');
      if (escalationTimer) clearInterval(escalationTimer);
      server.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { start };
