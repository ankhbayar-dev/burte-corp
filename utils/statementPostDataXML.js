function statementPostDataXML(loginName, loginPass, date, journalNo) {
  const journals = (journalNo || [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => `<JrnlNo><string>${item}</string></JrnlNo>`)
    .join('');

  return `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
  <Body>
    <AcntStatement xmlns="http://tempuri.org/">
      <UserName>${loginName}</UserName>
      <Pass>${loginPass}</Pass>
      <TxnDate>${date}</TxnDate>
      ${journals}
    </AcntStatement>
  </Body>
</Envelope>`;
}

module.exports = statementPostDataXML;
