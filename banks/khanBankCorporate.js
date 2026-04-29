const axios = require('axios');

const DEFAULT_TIMEOUT_MS = 30000;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} тохируулаагүй байна.`);
  return value.endsWith('/') ? value : `${value}/`;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function detectDirection(amount) {
  if (amount > 0) return 'ORLOGO';
  if (amount < 0) return 'ZARLAGA';
  return 'UNKNOWN';
}

function normalizeFetchMode(value) {
  const mode = String(value || 'ZARLAGA').toUpperCase();
  return ['ORLOGO', 'ZARLAGA', 'BOTH'].includes(mode) ? mode : 'ZARLAGA';
}

function normalizeTime(value) {
  const raw = String(value || '').replace(/\D/g, '');
  if (raw.length < 6) return null;
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)}:${raw.slice(4, 6)}`;
}

function normalizeDate(tranDate, time) {
  const date = String(tranDate || '').slice(0, 10);
  if (!date) return new Date().toISOString();

  const normalizedTime = normalizeTime(time);
  return normalizedTime ? `${date}T${normalizedTime}+08:00` : date;
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
    direction: detectDirection(amount),
    txnDesc: compactText(tx.description),
    txnDate: normalizeDate(tx.tranDate || tx.postDate, tx.time),
    khanRecord: record,
    relatedAccount: tx.relatedAccount || null,
    balance: toNumber(tx.balance),
  };
}

async function getKhanToken(baseUrl, corporate) {
  const response = await axios.post(
    `${baseUrl}auth/token?grant_type=client_credentials`,
    null,
    {
      auth: {
        username: corporate.loginName,
        password: corporate.loginPass,
      },
      timeout: DEFAULT_TIMEOUT_MS,
    }
  );

  const token = response.data?.access_token;
  if (!token) throw new Error('Khan Bank access_token ирсэнгүй.');
  return token;
}

module.exports = async function khanBankCorporate(corporate) {
  const baseUrl = requiredEnv('KHAN_URL');
  const accountNumber = String(corporate.accountNumber || corporate.journalNo || '').trim();
  if (!accountNumber) throw new Error('Khan Bank дансны дугаар (accountNumber) тохируулаагүй байна.');

  const token = await getKhanToken(baseUrl, corporate);
  const lastRecord = String(corporate.journalNo || '0').trim();
  const recordQuery = `?record=${encodeURIComponent(lastRecord || '0')}`;

  const response = await axios.get(
    `${baseUrl}statements/${encodeURIComponent(accountNumber)}/record${recordQuery}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: DEFAULT_TIMEOUT_MS,
    }
  );

  const rawTransactions = response.data?.transactions || [];
  const nextJournalNo = Array.isArray(rawTransactions)
    ? rawTransactions.reduce((max, tx) => {
        const record = Number(tx.record);
        return Number.isFinite(record) && record > max ? record : max;
      }, Number(lastRecord) || 0)
    : Number(lastRecord) || 0;

  if (!Array.isArray(rawTransactions) || rawTransactions.length === 0) {
    return {
      transactions: [],
      meta: {
        account: response.data?.account || accountNumber,
        lastRecord,
        nextJournalNo: nextJournalNo > 0 ? String(nextJournalNo) : null,
        message: 'No new transactions found for Khan Bank account.',
      },
    };
  }

  const fetchMode = normalizeFetchMode(corporate.fetchMode);
  const transactions = rawTransactions
    .map((tx) => mapTransaction(accountNumber, tx))
    .filter((tx) => tx.direction !== 'UNKNOWN')
    .filter((tx) => fetchMode === 'BOTH' || tx.direction === fetchMode);

  return {
    transactions,
    meta: {
      account: response.data?.account || accountNumber,
      beginDate: response.data?.beginDate || null,
      endDate: response.data?.endDate || null,
      lastRecord,
      nextJournalNo: nextJournalNo > 0 ? String(nextJournalNo) : null,
      fetchedCount: rawTransactions.length,
    },
  };
};
