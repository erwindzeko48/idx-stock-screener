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
      const stocks = data.data.map(d => ({
        symbol: d.TickerCode + '.JK',
        name: d.EmitenName,
        sector: d.SectorName || 'default'
      }));

      const fileContent = `// Automatically generated list of ${stocks.length} IDX stocks
export interface StockItem {
  symbol: string;
  name: string;
  sector: string;
}

export const IDX_STOCKS: StockItem[] = ${JSON.stringify(stocks, null, 2)};

export const SECTOR_AVG_PE: Record<string, number> = {
  'default': 15.0
};

export const SECTOR_AVG_PBV: Record<string, number> = {
  'default': 1.5
};
`;
      fs.writeFileSync('src/lib/stocks-list.ts', fileContent);
      console.log('Saved', stocks.length, 'stocks!');
    } catch (err) {
      console.log('Error parsing JSON:', err.message);
      console.log('Body start:', body.slice(0, 100));
    }
  });
});

req.on('error', err => console.error(err));
req.end();
