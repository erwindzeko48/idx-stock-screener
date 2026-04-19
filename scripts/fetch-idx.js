const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'www.idx.co.id',
  path: '/primary/ListedCompany/GetCompanyProfiles?start=0&length=1000',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json'
  }
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const raw = (Array.isArray(data?.data) ? data.data : [])
        .map(d => [
          `${String(d?.TickerCode || '').trim().toUpperCase()}.JK`,
          String(d?.EmitenName || d?.TickerCode || '').trim(),
          String(d?.SectorName || 'default').trim() || 'default',
        ])
        .filter(([symbol]) => /^[A-Z0-9]+\.JK$/.test(symbol));

      const uniqueBySymbol = [...new Map(raw.map(s => [s[0], s])).values()]
        .sort((a, b) => a[0].localeCompare(b[0]));

      const rows = uniqueBySymbol
        .map(([symbol, name, sector]) => `  ['${symbol.replace(/'/g, "\\'")}', '${name.replace(/'/g, "\\'")}', '${sector.replace(/'/g, "\\'")}']`)
        .join(',\n');

      const fileContent = `// Automatically generated list of ${uniqueBySymbol.length} IDX stocks from IDX Company Profiles API
// Format: [symbol, name, sector]
export const IDX_STOCKS: [string, string, string][] = [
${rows}
];

export const SECTOR_AVG_PE: Record<string, number> = {
  default: 15,
};

export const SECTOR_AVG_PBV: Record<string, number> = {
  default: 1.5,
};
`;
      fs.writeFileSync('src/lib/stocks-list.ts', fileContent);
      console.log('Saved', uniqueBySymbol.length, 'stocks!');
    } catch (err) {
      console.log('Error parsing JSON:', err.message);
      console.log('Body start:', body.slice(0, 100));
    }
  });
});

req.on('error', err => console.error(err));
req.end();
