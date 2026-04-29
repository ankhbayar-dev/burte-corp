/**
 * burteGraphConfig.js
 *
 * burteGraph-аас идэвхтэй CorporateAccount тохиргоог татна.
 * JWT token-аар нэвтэрнэ (burteGraphAuth.js).
 */

const axios = require('axios');
const { getAuthHeader, clearToken } = require('./burteGraphAuth');

const BURTE_GRAPH_URL = process.env.BURTE_GRAPH_URL || 'http://localhost:4000/graphql';

const CORPORATE_ACCOUNTS_QUERY = `
  query GetEnabledCorporateAccounts {
    enabledCorporateAccounts {
      id
      organizationId
      bank
      loginName
      loginPass
      accountNumber
      journalNo
      startDate
      fetchMode
      bankAccountId
      enabled
    }
  }
`;

/**
 * burteGraph-аас бүх идэвхтэй CorporateAccount-уудыг татна.
 *
 * @returns {Promise<Array>} — index.js-д ашиглах corporates массив
 */
async function fetchCorporateAccounts() {
  const authHeader = await getAuthHeader();

  let response;
  try {
    console.log(BURTE_GRAPH_URL);
    response = await axios.post(
      BURTE_GRAPH_URL,
      { query: CORPORATE_ACCOUNTS_QUERY },
      { headers: { 'Content-Type': 'application/json', ...authHeader }, timeout: 15000 }
    );
    console.log(response.data);
  } catch (err) {
    // Сүлжээний алдаа
    throw new Error(`burteGraph холболтын алдаа: ${err.message}`);
  }

  if (response.data.errors && response.data.errors.length > 0) {
    const msg = response.data.errors.map((e) => e.message).join('; ');
    // Нэвтрэлтийн алдаа бол кэш цэвэрлэж дахин оролдуулна
    if (msg.includes('Нэвтрэх') || msg.includes('auth') || msg.includes('token')) {
      clearToken();
    }
    throw new Error(`burteGraph GraphQL алдаа: ${msg}`);
  }

  const corporateAccounts = response.data.data?.enabledCorporateAccounts || [];

  return corporateAccounts.map((ca) => ({
    corporateAccountId: ca.id,
    id: ca.id,
    bank: ca.bank,
    loginName: ca.loginName,
    loginPass: ca.loginPass,
    accountNumber: ca.accountNumber,
    journalNo: ca.journalNo,
    startDate: ca.startDate,
    fetchMode: ca.fetchMode || 'ZARLAGA',
    enabled: ca.enabled,
  }));
}

module.exports = { fetchCorporateAccounts };
