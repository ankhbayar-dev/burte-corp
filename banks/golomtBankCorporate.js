const axios = require('axios');
const getOauthCorporateToken = require('./tokens/oauthCorporateToken');
const {
  DEFAULT_TIMEOUT_MS,
  compactText,
  detectSignedAmountDirection,
  filterByFetchMode,
  firstEnv,
  formatAxiosError,
  maxNumericField,
  normalizeDate,
  stripTrailingSlash,
  toNumber,
} = require('./bankUtils');

function requiredBaseUrl() {
  const value = firstEnv(['GOLOMT_URL', 'TDB_URL', 'TDB_CORPORATE_URL']);
  if (!value) throw new Error('GOLOMT_URL or TDB_URL is not configured.');
  return stripTrailingSlash(value);
}

function mapTransaction(accountNumber, tx) {
  const amount = toNumber(tx.amount);
  const record = tx.record === undefined || tx.record === null ? null : String(tx.record);

  return {
    acntNo: tx.account || accountNumber,
    branch: tx.branch || null,
    journalNo: record || (tx.journal === undefined ? null : String(tx.journal)),
    txnType: tx.code === undefined ? null : String(tx.code),
    amount: Math.abs(amount),
    direction: detectSignedAmountDirection(amount),
    txnDesc: compactText(tx.description),
    txnDate: normalizeDate(tx.tranDate || tx.postDate, tx.time),
    relatedAccount: tx.relatedAccount || null,
    balance: toNumber(tx.balance),
  };
}

module.exports = async function golomtBankCorporate(corporate) {
  const baseUrl = requiredBaseUrl();
  const accountNumber = String(corporate.accountNumber || corporate.journalNo || '').trim();
  if (!accountNumber) throw new Error('Golomt Bank accountNumber is not configured.');

  const token = await getOauthCorporateToken(corporate, {
    bankName: 'Golomt Bank',
    baseUrlEnvNames: ['GOLOMT_CORPORATE_URL', 'TDB_CORPORATE_URL'],
    clientIdEnvNames: ['GOLOMT_CORPORATE_ID', 'TDB_CORPORATE_ID', 'TDB_COPRORATE_ID'],
    clientSecretEnvNames: [
      'GOLOMT_CORPORATE_SECRET',
      'TDB_CORPORATE_SECRET',
      'TDB_COPRORATE_SERCRET',
    ],
  });
  const lastRecord = String(corporate.journalNo || '0').trim();
  const recordQuery = `?record=${encodeURIComponent(lastRecord || '0')}`;

  let response;
  try {
    response = await axios.get(
      `${baseUrl}/accounts/statement/${encodeURIComponent(accountNumber)}/record${recordQuery}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: DEFAULT_TIMEOUT_MS,
      }
    );
  } catch (error) {
    throw new Error(
      formatAxiosError(
        error,
        `Golomt Bank statement request failed account=${accountNumber} record=${lastRecord || '0'}`
      )
    );
  }

  const rawTransactions = response.data?.transactions || [];
  const rawList = Array.isArray(rawTransactions) ? rawTransactions : [];
  const currentJournalNo = Number(lastRecord) || 0;
  const nextJournalNo = maxNumericField(rawList, 'record', currentJournalNo);

  if (rawList.length === 0) {
    return {
      transactions: [],
      meta: {
        account: response.data?.account || accountNumber,
        lastRecord,
        nextJournalNo: nextJournalNo > 0 ? String(nextJournalNo) : null,
        message: 'No new transactions found for Golomt Bank account.',
      },
    };
  }

  const transactions = filterByFetchMode(
    rawList
      .filter((tx) => {
        const record = Number(tx.record);
        if (!Number.isFinite(record)) return true;
        return record > currentJournalNo;
      })
      .map((tx) => mapTransaction(accountNumber, tx)),
    corporate.fetchMode
  );

  return {
    transactions,
    meta: {
      account: response.data?.account || accountNumber,
      lastRecord,
      nextJournalNo: nextJournalNo > 0 ? String(nextJournalNo) : null,
      fetchedCount: rawList.length,
    },
  };
};
