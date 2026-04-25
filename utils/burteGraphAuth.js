/**
 * burteGraphAuth.js
 *
 * burteGraph-руу email/password-аар нэвтэрч JWT token авна.
 * Token-г кэшэд хадгалж, хүчинтэй байх хугацаанд дахин login хийхгүй.
 */

const axios = require('axios');

const BURTE_GRAPH_URL  = process.env.BURTE_GRAPH_URL    || 'http://localhost:4000/graphql';
const BURTE_GRAPH_EMAIL    = process.env.BURTEGRAPH_EMAIL    || '';
const BURTE_GRAPH_PASSWORD = process.env.BURTEGRAPH_PASSWORD || '';

const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
    }
  }
`;

let cachedToken   = null;
let tokenFetchedAt = 0;
// 23 цаг — JWT ихэвчлэн 24 цаг хүчинтэй байдаг
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

/**
 * burteGraph-аас JWT token авна.
 * Token кэшлэгдсэн бөгөөд хугацаа дуусаагүй бол дахин login хийхгүй.
 *
 * @returns {Promise<string>} JWT token
 */
async function getToken() {
  const now = Date.now();
  if (cachedToken && (now - tokenFetchedAt) < TOKEN_TTL_MS) {
    return cachedToken;
  }

  if (!BURTE_GRAPH_EMAIL)    throw new Error('BURTEGRAPH_EMAIL тохируулаагүй байна.');
  if (!BURTE_GRAPH_PASSWORD) throw new Error('BURTEGRAPH_PASSWORD тохируулаагүй байна.');

  const response = await axios.post(
    BURTE_GRAPH_URL,
    { query: LOGIN_MUTATION, variables: { email: BURTE_GRAPH_EMAIL, password: BURTE_GRAPH_PASSWORD } },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  );

  if (response.data.errors && response.data.errors.length > 0) {
    const msg = response.data.errors.map((e) => e.message).join('; ');
    throw new Error(`burteGraph нэвтрэлт амжилтгүй: ${msg}`);
  }

  const token = response.data.data?.login?.token;
  if (!token) throw new Error('burteGraph-аас token ирсэнгүй.');

  cachedToken    = token;
  tokenFetchedAt = now;
  return token;
}

/**
 * Token-тэй Authorization header буцаана.
 */
async function getAuthHeader() {
  const token = await getToken();
  return { Authorization: `Bearer ${token}` };
}

/** Token кэшийг цэвэрлэнэ (алдаа гарсан үед дахин login хийлгэх) */
function clearToken() {
  cachedToken    = null;
  tokenFetchedAt = 0;
}

module.exports = { getToken, getAuthHeader, clearToken };
