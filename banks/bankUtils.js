const DEFAULT_TIMEOUT_MS = 30000;

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function requiredEnv(name, options = {}) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return options.trailingSlash
    ? value.endsWith('/') ? value : `${value}/`
    : stripTrailingSlash(value);
}

function firstEnv(names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return null;
}

function toNumber(value) {
  const number = Number(String(value || '0').replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeFetchMode(value) {
  const mode = String(value || 'ZARLAGA').toUpperCase();
  return ['ORLOGO', 'ZARLAGA', 'BOTH'].includes(mode) ? mode : 'ZARLAGA';
}

function compactErrorData(data) {
  if (!data) return '';
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return text.replace(/\s+/g, ' ').trim().slice(0, 800);
}

function formatAxiosError(error, fallbackMessage) {
  const status = error?.response?.status;
  const statusText = error?.response?.statusText;
  const responseData = compactErrorData(error?.response?.data);
  return [
    fallbackMessage,
    error?.message,
    status ? `status=${status}${statusText ? ` ${statusText}` : ''}` : null,
    responseData ? `response=${responseData}` : null,
  ].filter(Boolean).join(' | ');
}

function detectSignedAmountDirection(amount) {
  if (amount > 0) return 'ORLOGO';
  if (amount < 0) return 'ZARLAGA';
  return 'UNKNOWN';
}

function detectDebitCreditDirection(tx) {
  const credit = toNumber(tx.credit);
  const debit = toNumber(tx.debit);
  if (credit > 0) return 'ORLOGO';
  if (debit > 0) return 'ZARLAGA';
  return detectSignedAmountDirection(credit - debit);
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

function formatDate(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return null;

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function today() {
  return formatDate(new Date());
}

function tomorrowFrom(dateText) {
  const normalized = String(dateText || '').replace(/\//g, '-');
  const value = new Date(`${normalized}T00:00:00+08:00`);
  if (Number.isNaN(value.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 1);
    return formatDate(fallback);
  }
  value.setDate(value.getDate() + 1);
  return formatDate(value);
}

function maxNumericField(items, fieldName, fallback = 0) {
  if (!Array.isArray(items)) return fallback;
  return items.reduce((max, item) => {
    const value = Number(item?.[fieldName]);
    return Number.isFinite(value) && value > max ? value : max;
  }, fallback);
}

function filterByFetchMode(transactions, fetchMode) {
  const mode = normalizeFetchMode(fetchMode);
  return transactions
    .filter((tx) => tx.direction !== 'UNKNOWN')
    .filter((tx) => mode === 'BOTH' || tx.direction === mode);
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  stripTrailingSlash,
  requiredEnv,
  firstEnv,
  toNumber,
  compactText,
  normalizeFetchMode,
  formatAxiosError,
  detectSignedAmountDirection,
  detectDebitCreditDirection,
  normalizeDate,
  formatDate,
  today,
  tomorrowFrom,
  maxNumericField,
  filterByFetchMode,
};
