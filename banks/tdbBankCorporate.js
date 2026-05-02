const axios = require('axios');
const getOauthCorporateToken = require('./tokens/oauthCorporateToken');
const {
  DEFAULT_TIMEOUT_MS,
  compactText,
  detectDebitCreditDirection,
  filterByFetchMode,
  formatAxiosError,
  formatDate,
  maxNumericField,
  requiredEnv,
  stripTrailingSlash,
  today,
  tomorrowFrom,
  toNumber,
} = require('./bankUtils');

const DEFAULT_PAGE_SIZE = 1000;

function mapTransaction(accountNumber, tx) {
  const credit = toNumber(tx.credit);
  const debit = toNumber(tx.debit);

  return {
    acntNo: accountNumber,
    branch: tx.branch || null,
    journalNo: tx.refno === undefined || tx.refno === null ? null : String(tx.refno),
    txnType: tx.txntype || tx.txnType || null,
    amount: Math.abs(credit - debit),
    direction: detectDebitCreditDirection(tx),
    txnDesc: compactText(tx.txndesc),
    txnDate: tx.txndate || new Date().toISOString(),
    relatedAccount: tx.contacntno || null,
    balance: toNumber(tx.balance),
  };
}

module.exports = async function tdbBankCorporate(corporate) {
  const baseUrl = stripTrailingSlash(process.env.TDB_URL || requiredEnv('TDB_CORPORATE_URL'));
  const accountNumber = String(corporate.accountNumber || corporate.journalNo || '').trim();
  if (!accountNumber) throw new Error('TDB Bank accountNumber/IBAN is not configured.');

  const token = await getOauthCorporateToken(corporate, {
    bankName: 'TDB Bank',
    baseUrlEnvNames: ['TDB_CORPORATE_URL'],
    clientIdEnvNames: ['TDB_CORPORATE_ID', 'TDB_COPRORATE_ID'],
    clientSecretEnvNames: ['TDB_CORPORATE_SECRET', 'TDB_COPRORATE_SERCRET'],
  });
  const lastRecord = String(corporate.journalNo || '0').trim();
  const from = lastRecord && lastRecord !== '0' ? today() : formatDate(corporate.startDate) || today();
  const to = tomorrowFrom(from);
  const pageSize = Number(process.env.TDB_STATEMENT_PAGE_SIZE || DEFAULT_PAGE_SIZE);

  let response;
  try {
    response = await axios.get(
      `${baseUrl}/accounts/statement/${encodeURIComponent(accountNumber)}`,
      {
        params: { from, to, page: 1, size: pageSize },
        headers: { Authorization: `Bearer ${token}` },
        timeout: DEFAULT_TIMEOUT_MS,
      }
    );
  } catch (error) {
    throw new Error(
      formatAxiosError(
        error,
        `TDB Bank statement request failed account=${accountNumber} from=${from} to=${to}`
      )
    );
  }

  const rawTransactions = response.data?.txn || [];
  const rawList = Array.isArray(rawTransactions) ? rawTransactions : [];
  const currentJournalNo = Number(lastRecord) || 0;
  const nextJournalNo = maxNumericField(rawList, 'refno', currentJournalNo);

  if (rawList.length === 0) {
    return {
      transactions: [],
      meta: {
        account: accountNumber,
        from,
        to,
        lastRecord,
        nextJournalNo: nextJournalNo > 0 ? String(nextJournalNo) : null,
        message: 'No new transactions found for TDB Bank account.',
      },
    };
  }

  const transactions = filterByFetchMode(
    rawList
      .filter((tx) => {
        const refno = Number(tx.refno);
        if (!Number.isFinite(refno)) return true;
        return refno > currentJournalNo;
      })
      .map((tx) => mapTransaction(accountNumber, tx)),
    corporate.fetchMode
  );

  return {
    transactions,
    meta: {
      account: accountNumber,
      from,
      to,
      lastRecord,
      nextJournalNo: nextJournalNo > 0 ? String(nextJournalNo) : null,
      fetchedCount: rawList.length,
    },
  };
};
