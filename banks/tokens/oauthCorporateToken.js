const axios = require('axios');
const {
  DEFAULT_TIMEOUT_MS,
  firstEnv,
  formatAxiosError,
  stripTrailingSlash,
} = require('../bankUtils');

module.exports = async function getOauthCorporateToken(corporate, options = {}) {
  const bankName = options.bankName || 'Corporate bank';
  const baseUrl = stripTrailingSlash(
    firstEnv(options.baseUrlEnvNames || ['TDB_CORPORATE_URL'])
  );
  const clientId =
    corporate.loginName || firstEnv(options.clientIdEnvNames || ['TDB_CORPORATE_ID', 'TDB_COPRORATE_ID']);
  const clientSecret =
    corporate.loginPass ||
    firstEnv(options.clientSecretEnvNames || ['TDB_CORPORATE_SECRET', 'TDB_COPRORATE_SERCRET']);

  if (!baseUrl) throw new Error(`${bankName} token URL is not configured.`);
  if (!clientId) throw new Error(`${bankName} client_id/loginName is not configured.`);
  if (!clientSecret) throw new Error(`${bankName} client_secret/loginPass is not configured.`);

  let response;
  try {
    response = await axios.post(
      `${baseUrl}/oauth2/token`,
      {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      },
      { timeout: DEFAULT_TIMEOUT_MS }
    );
  } catch (error) {
    throw new Error(formatAxiosError(error, `${bankName} token request failed`));
  }

  const token = response.data?.token || response.data?.access_token;
  if (!token) throw new Error(`${bankName} token was not returned.`);
  return token;
};
