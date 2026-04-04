const axios = require('axios');
const statementPostDataXML = require('../utils/statementPostDataXML');

const STATE_BANK_URL =
  'https://e.statebank.mn/acntstatement/statement.asmx?op=AcntStatement';

function extractTagValues(xml, tagName) {
  const safeTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<(?:(?:\\w+:)?${safeTag})>([\\s\\S]*?)<\\/(?:(?:\\w+:)?${safeTag})>`,
    'gi'
  );

  const values = [];
  let match = regex.exec(xml);
  while (match) {
    values.push(match[1].trim());
    match = regex.exec(xml);
  }

  return values;
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sliceText(value, max = 600) {
  const text = compactText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function detectDirection(txnType, amount) {
  const type = String(txnType || '').toUpperCase();
  if (['ADD', 'CR', 'CREDIT', 'IN'].includes(type)) return 'ORLOGO';
  if (['SUB', 'DR', 'DEBIT', 'OUT'].includes(type)) return 'ZARLAGA';
  if (Number(amount) < 0) return 'ZARLAGA';
  if (Number(amount) > 0) return 'ORLOGO';
  return 'UNKNOWN';
}

module.exports = async function stateBankCorporate(corporate) {
  const journalNo = Array.isArray(corporate.journalNo)
    ? corporate.journalNo
    : String(corporate.journalNo || '0').split(',');

  const postData = statementPostDataXML(
    corporate.loginName,
    corporate.loginPass,
    corporate.startDate,
    journalNo
  );
  console.log(postData)

  let response;
  try {
    console.log(STATE_BANK_URL);
    response = await axios.post(STATE_BANK_URL, postData, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 20000,
    });
console.log(response.data)

  } catch (error) {
    const status = error?.response?.status;
    const statusText = error?.response?.statusText;
    const responseData = error?.response?.data;
    const body =
      typeof responseData === 'string' ? responseData : JSON.stringify(responseData || {});

    const errCode =
      extractTagValues(body, 'ErrCode')[0] || extractTagValues(body, 'faultcode')[0] || null;
    const errDesc =
      extractTagValues(body, 'ErrDesc')[0] ||
      extractTagValues(body, 'faultstring')[0] ||
      null;

    const message = [
      status ? `status=${status}${statusText ? ` ${statusText}` : ''}` : null,
      errCode ? `bankErrCode=${compactText(errCode)}` : null,
      errDesc ? `bankErrDesc=${compactText(errDesc)}` : null,
      `response=${sliceText(body)}`,
    ]
      .filter(Boolean)
      .join(' | ');

      console.log(message);

    throw new Error(message || 'State bank request failed');
  }
      const xml = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  const errCode = extractTagValues(xml, 'ErrCode')[0] || null;
  const errDesc = extractTagValues(xml, 'ErrDesc')[0] || null;

  const acntNos = extractTagValues(xml, 'AcntNo');
  const branches = extractTagValues(xml, 'Branch');
  const journalNos = extractTagValues(xml, 'JournalNo');
  const txnTypes = extractTagValues(xml, 'TxnType');
  const amounts = extractTagValues(xml, 'Amount');
  const txnDescs = extractTagValues(xml, 'TxnDesc');
  const txnDates = extractTagValues(xml, 'TxnDate');

  const maxLen = Math.max(
    journalNos.length,
    txnTypes.length,
    amounts.length,
    txnDescs.length,
    txnDates.length,
    0
  );

  const transactions = [];
  for (let i = 0; i < maxLen; i += 1) {
    const amount = Number(String(amounts[i] || '0').replace(/,/g, '')) || 0;

    transactions.push({
      acntNo: acntNos[i] || null,
      branch: branches[i] || null,
      journalNo: journalNos[i] || null,
      txnType: txnTypes[i] || null,
      amountRaw: amounts[i] || null,
      amount,
      direction: detectDirection(txnTypes[i], amount),
      txnDesc: txnDescs[i] || null,
      txnDate: txnDates[i] || null,
    });
  }
  return {
    transactions,
    meta: {
      errCode,
      errDesc,
    },
  };
};
