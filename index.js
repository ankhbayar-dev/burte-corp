require('dotenv').config();

const bankRunners = require('./banks');
const logger = require('./utils/logger');
const transactionStore = require('./utils/transactionStore');
const { syncToburteGraph } = require('./utils/burteGraphSync');
const { fetchCorporateAccounts } = require('./utils/burteGraphConfig');

const CHECK_INTERVAL_MS  = Number(process.env.CHECK_INTERVAL_MS || 5 * 60 * 1000);
const LOG_TRANSACTIONS   = String(process.env.LOG_TRANSACTIONS || 'false') === 'true';
let isRunning = false;

function compactErrorData(data) {
  if (!data) return '';
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return text.replace(/\s+/g, ' ').trim().slice(0, 800);
}

function formatError(error) {
  const status = error?.response?.status;
  const statusText = error?.response?.statusText;
  const responseData = compactErrorData(error?.response?.data);
  return [
    error?.message,
    status ? `status=${status}${statusText ? ` ${statusText}` : ''}` : null,
    responseData ? `response=${responseData}` : null,
  ].filter(Boolean).join(' | ');
}

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

  // burteGraph-д sync хийнэ
  try {
    const syncResult = await syncToburteGraph({
      corporateAccountId: corporate.corporateAccountId,
      transactions: result.transactions,
      lastJournalNo: meta.nextJournalNo,
    });
    logger.info(
      `[SYNC] ${corporate.id} -> burteGraph | imported=${syncResult.importedCount} | skipped=${syncResult.skippedCount} | status=${syncResult.status} | syncLogId=${syncResult.syncLogId}`
    );
  } catch (syncErr) {
    logger.error(`[SYNC] ${corporate.id} -> burteGraph алдаа: ${syncErr.message}`);
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
    // burteGraph-аас тохиргоог татна
    let corporates;
    try {
      corporates = await fetchCorporateAccounts();
      logger.info(`[CONFIG] burteGraph-аас ${corporates.length} corporate account татлаа.`);
    } catch (configErr) {
      logger.error(`[CONFIG] burteGraph-аас config татахад алдаа гарлаа: ${configErr.message}`);
      return;
    }

    if (corporates.length === 0) {
      logger.info('[CONFIG] Идэвхтэй corporate account байхгүй байна.');
      return;
    }

    for (const corporate of corporates) {
      try {
        await checkCorporate(corporate);
      } catch (error) {
        logger.error(
          `[ERROR] ${corporate.id} | bank=${corporate.bank} | account=${corporate.accountNumber || '-'} | cursor=${corporate.journalNo || '-'} -> ${formatError(error)}`
        );
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
