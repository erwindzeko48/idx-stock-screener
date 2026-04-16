const fs = require('fs');

async function fetchIdx() {
  const res = await fetch('https://id.wikipedia.org/wiki/Daftar_perusahaan_yang_tercatat_di_Bursa_Efek_Indonesia');
  const html = await res.text();
  const matches = [...html.matchAll(/<td>([A-Z]{4})<\/td>/g)];
  const symbols = [...new Set(matches.map(m => m[1]))];
  console.log('Found', symbols.length, 'symbols. First 5:', symbols.slice(0, 5));
  
  if (symbols.length > 100) {
    const tsContent = `export interface StockItem {
  symbol: string;
  name: string;
  sector: string;
}

export const IDX_STOCKS: StockItem[] = [
${symbols.map(s => `  { symbol: '${s}.JK', name: '${s}', sector: 'default' }`).join(',\n')}
];

export const SECTOR_AVG_PE: Record<string, number> = { 'default': 15.0 };
export const SECTOR_AVG_PBV: Record<string, number> = { 'default': 1.5 };
`;
    fs.writeFileSync('src/lib/stocks-list.ts', tsContent);
    console.log('Saved to src/lib/stocks-list.ts');
  }
}

fetchIdx().catch(console.error);
