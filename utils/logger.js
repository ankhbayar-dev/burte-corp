const fs = require('fs');
const path = require('path');

const LOG_TO_FILE = String(process.env.LOG_TO_FILE || 'true') === 'true';
const LOG_FILE = process.env.LOG_FILE || path.join(__dirname, '..', 'logs', 'corporate.log');

function write(level, message) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;

  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);

  if (!LOG_TO_FILE) return;

  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
}

module.exports = {
  info(message) {
    write('INFO', message);
  },
  warn(message) {
    write('WARN', message);
  },
  error(message) {
    write('ERROR', message);
  },
};
