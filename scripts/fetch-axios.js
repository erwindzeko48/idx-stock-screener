const axios = require('axios');
const fs = require('fs');

async function run() {
  try {
    const res = await axios.get('https://raw.githubusercontent.com/yusufm199/idx-stock-list/master/data.json');
    const data = res.data;
    const stocks = data.map(d => ({ symbol: d.ticker + '.JK', name: d.name, sector: 'default' }));
    
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
  } catch (err) {
    console.error(err.message);
  }
}

run();
