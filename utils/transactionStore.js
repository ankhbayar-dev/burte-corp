const fs = require('fs');
const path = require('path');

const SAVE_TRANSACTIONS_TO_FILE =
  String(process.env.SAVE_TRANSACTIONS_TO_FILE || 'true') === 'true';
const TRANSACTION_LOG_FILE =
  process.env.TRANSACTION_LOG_FILE ||
  path.join(__dirname, '..', 'logs', 'transactions.ndjson');

function ensureDir() {
  const dir = path.dirname(TRANSACTION_LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendLine(line) {
  ensureDir();
  fs.appendFileSync(TRANSACTION_LOG_FILE, `${line}\n`, 'utf8');
}

function saveTransactions(corporate, transactions) {
  if (!SAVE_TRANSACTIONS_TO_FILE) return;
  if (!Array.isArray(transactions) || transactions.length === 0) return;

  const loggedAt = new Date().toISOString();
  for (const tx of transactions) {
    appendLine(
      JSON.stringify({
        loggedAt,
        corporateId: corporate.id,
        bank: corporate.bank,
        ...tx,
      })
    );
  }
}

module.exports = {
  saveTransactions,
  TRANSACTION_LOG_FILE,
};
