require('dotenv').config();

const corporates = require('./corporates.json');
const bankRunners = require('./banks');
const logger = require('./utils/logger');
const transactionStore = require('./utils/transactionStore');

const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS || 5 * 60 * 1000);
const LOG_TRANSACTIONS = String(process.env.LOG_TRANSACTIONS || 'false') === 'true';
let isRunning = false;

function summarizeDirections(transactions) {
  const summary = { ORLOGO: 0, ZARLAGA: 0, UNKNOWN: 0 };
  for (const tx of transactions) {
    const direction = tx.direction || 'UNKNOWN';
    if (!summary[direction]) summary[direction] = 0;
    summary[direction] += 1;
  }
  return summary;
}

async function checkCorporate(corporate) {
  const runner = bankRunners[corporate.bank];

  if (!runner) {
    logger.warn(`[SKIP] ${corporate.id} -> unsupported bank: ${corporate.bank}`);
    return;
  }

  const result = await runner(corporate);
  const meta = result.meta || {};
  const summary = summarizeDirections(result.transactions);

  logger.info(
    `[OK] ${corporate.id} | bank=${corporate.bank} | tx=${result.transactions.length} | orlogo=${summary.ORLOGO} | zarlaga=${summary.ZARLAGA} | unknown=${summary.UNKNOWN} | errCode=${meta.errCode || '-'} | errDesc=${meta.errDesc || '-'}`
  );

  if (summary.UNKNOWN > 0) {
    logger.warn(`[UNKNOWN] ${corporate.id} has ${summary.UNKNOWN} unknown direction txn`);
  }

  transactionStore.saveTransactions(corporate, result.transactions);
  logger.info(
    `[STORE] ${corporate.id} -> saved=${result.transactions.length} to ${transactionStore.TRANSACTION_LOG_FILE}`
  );

  if (LOG_TRANSACTIONS) {
    for (const tx of result.transactions) {
      logger.info(`[TX] ${corporate.id} | ${JSON.stringify(tx)}`);
    }
  }
}

async function runAll() {
  if (isRunning) {
    logger.info('[INFO] Previous cycle is still running. Skipped this interval.');
    return;
  }

  isRunning = true;
  logger.info(`[START] ${new Date().toISOString()}`);

  try {
    for (const corporate of corporates) {
      if (corporate.enabled === false) {
        continue;
      }

      try {
        await checkCorporate(corporate);
      } catch (error) {
        logger.error(`[ERROR] ${corporate.id} -> ${error.message}`);
      }
    }
  } finally {
    isRunning = false;
    logger.info(`[END] ${new Date().toISOString()}`);
  }
}

runAll();
setInterval(runAll, CHECK_INTERVAL_MS);

logger.info(`[BOOT] Interval: ${CHECK_INTERVAL_MS} ms`);
