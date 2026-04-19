const fs = require('fs');

async function fetchIdx() {
  const res = await fetch('https://id.wikipedia.org/wiki/Daftar_perusahaan_yang_tercatat_di_Bursa_Efek_Indonesia');
  const html = await res.text();

  // Robust extraction from IDX profile links embedded in page source
  const matches = [...html.matchAll(/profil-perusahaan-tercatat\/([A-Z0-9]{2,6})/g)];
  const symbols = [...new Set(matches.map((m) => m[1]))].sort();
  console.log('Found', symbols.length, 'symbols. First 5:', symbols.slice(0, 5));

  if (symbols.length > 100) {
    const rows = symbols
      .map((s) => `  ['${s}.JK', '${s}', 'default']`)
      .join(',\n');

    const tsContent = `// Automatically generated full IDX stock universe (${symbols.length} symbols)
// Source: https://id.wikipedia.org/wiki/Daftar_perusahaan_yang_tercatat_di_Bursa_Efek_Indonesia
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

    fs.writeFileSync('src/lib/stocks-list.ts', tsContent);
    console.log('Saved to src/lib/stocks-list.ts');
  }
}

fetchIdx().catch(console.error);
