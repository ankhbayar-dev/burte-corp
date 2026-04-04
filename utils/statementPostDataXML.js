function statementPostDataXML(loginName, loginPass, date, journalNo) {
  const journals = (journalNo || [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => `<JrnlNo><string>${item}</string></JrnlNo>`)
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <AcntStatement xmlns="http://tempuri.org/">
      <UserName>${loginName}</UserName>
      <Pass>${loginPass}</Pass>
      <TxnDate>${date}</TxnDate>
      ${journals}
    </AcntStatement>
  </soap:Body>
</soap:Envelope>`;
}

module.exports = statementPostDataXML;
