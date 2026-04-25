function statementPostDataXML(loginName, loginPass, date, journalNo) {
  const strings = (journalNo || [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => `        <string>${item}</string>`)
    .join('\n');

  const txnDate = String(date || '').replace(' ', 'T').replace(/T(\d{2}:\d{2})$/, 'T$1:00');

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AcntStatement xmlns="http://tempuri.org/">
      <UserName>${loginName}</UserName>
      <Pass>${loginPass}</Pass>
      <TxnDate>${txnDate}</TxnDate>
      <JrnlNo>
${strings}
      </JrnlNo>
    </AcntStatement>
  </soap:Body>
</soap:Envelope>`;
}

module.exports = statementPostDataXML;
