/**
 * burteGraphSync.js
 *
 * burte-corporate → burteGraph GraphQL sync utility.
 * JWT token-аар нэвтэрнэ (burteGraphAuth.js).
 * SHA-256 hash ашиглан давхардал хориглоно.
 */

const crypto = require('crypto');
const axios  = require('axios');
const { getAuthHeader, clearToken } = require('./burteGraphAuth');

const BURTE_GRAPH_URL = process.env.BURTE_GRAPH_URL || 'http://localhost:4000/graphql';

/**
 * SHA256(corporateAccountId|txnDate|amount|direction|txnDesc)
 */
function computeSyncHash(corporateAccountId, txnDate, amount, direction, txnDesc) {
  const raw = [
    corporateAccountId,
    txnDate || '',
    String(Math.abs(Number(amount) || 0)),
    direction || 'UNKNOWN',
    (txnDesc || '').trim(),
  ].join('|');
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

const SYNC_MUTATION = `
  mutation SyncCorporateTransactions(
    $corporateAccountId: String!
    $lastJournalNo: String
    $rows: [CorporateTransactionRowInput!]!
  ) {
    syncCorporateTransactions(
      corporateAccountId: $corporateAccountId
      lastJournalNo: $lastJournalNo
      rows: $rows
    ) {
      syncLogId
      importedCount
      skippedCount
      status
      errorMessage
    }
  }
`;

async function syncToburteGraph({ corporateAccountId, transactions, lastJournalNo }) {
  if (!corporateAccountId) throw new Error('corporateAccountId тохируулаагүй байна.');

  const rows = transactions.map((tx) => ({
    txnDate:   tx.txnDate || new Date().toISOString(),
    acntNo:    tx.acntNo  || null,
    branch:    tx.branch  || null,
    journalNo: tx.journalNo || null,
    txnType:   tx.txnType || null,
    amount:    Math.abs(Number(tx.amount) || 0),
    direction: tx.direction || 'UNKNOWN',
    txnDesc:   tx.txnDesc  || null,
    syncHash:  computeSyncHash(corporateAccountId, tx.txnDate, tx.amount, tx.direction, tx.txnDesc),
  }));

  const authHeader = await getAuthHeader();

  let response;
  try {
    response = await axios.post(
      BURTE_GRAPH_URL,
      { query: SYNC_MUTATION, variables: { corporateAccountId, lastJournalNo, rows } },
      { headers: { 'Content-Type': 'application/json', ...authHeader }, timeout: 30000 }
    );
  } catch (err) {
    throw new Error(`burteGraph холболтын алдаа: ${err.message}`);
  }

  if (response.data.errors && response.data.errors.length > 0) {
    const msg = response.data.errors.map((e) => e.message).join('; ');
    if (msg.includes('Нэвтрэх') || msg.includes('auth') || msg.includes('token')) {
      clearToken();
    }
    throw new Error(`burteGraph GraphQL алдаа: ${msg}`);
  }

  return response.data.data.syncCorporateTransactions;
}

module.exports = { syncToburteGraph, computeSyncHash };
