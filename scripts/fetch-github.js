const https = require('https');
const fs = require('fs');

https.get('https://api.github.com/repos/yusufm199/idx-stock-list/contents/data.json', { headers: { 'User-Agent': 'node' } }, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      const stocks = JSON.parse(content).map(d => ({ symbol: d.ticker + '.JK', name: d.name, sector: 'default' }));
      
      const tsContent = `export interface StockItem {
  symbol: string;
  name: string;
  sector: string;
}

export const SECTOR_AVG_PE: Record<string, number> = { 'default': 15.0 };
export const SECTOR_AVG_PBV: Record<string, number> = { 'default': 1.5 };

export const IDX_STOCKS: StockItem[] = ${JSON.stringify(stocks, null, 2)};
`;
      fs.writeFileSync('src/lib/stocks-list.ts', tsContent);
      console.log('Saved', stocks.length, 'stocks!');
    } catch (e) {
      console.log('Error:', e.message);
    }
  });
});
