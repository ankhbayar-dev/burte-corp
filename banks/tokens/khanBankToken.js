const axios = require('axios');
const { DEFAULT_TIMEOUT_MS, formatAxiosError } = require('../bankUtils');

module.exports = async function getKhanBankToken(baseUrl, corporate) {
  if (!corporate.loginName) throw new Error('Khan Bank loginName is not configured.');
  if (!corporate.loginPass) throw new Error('Khan Bank loginPass is not configured.');

  let response;
  try {
    response = await axios.post(
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
  } catch (error) {
    throw new Error(formatAxiosError(error, 'Khan Bank token request failed'));
  }

  const token = response.data?.access_token || response.data?.token;
  if (!token) throw new Error('Khan Bank token was not returned.');
  return token;
};
