// Top IDX stocks from LQ45 + popular growth stocks
// Format: [symbol, name, sector]
export const IDX_STOCKS: [string, string, string][] = [
  // Banking
  ['BBCA.JK', 'Bank Central Asia', 'Banking'],
  ['BBRI.JK', 'Bank Rakyat Indonesia', 'Banking'],
  ['BMRI.JK', 'Bank Mandiri', 'Banking'],
  ['BBNI.JK', 'Bank Negara Indonesia', 'Banking'],
  ['BRIS.JK', 'BRI Syariah', 'Banking'],
  ['BTPS.JK', 'Bank BTPN Syariah', 'Banking'],
  ['BNGA.JK', 'Bank CIMB Niaga', 'Banking'],
  ['BNII.JK', 'Bank Maybank Indonesia', 'Banking'],
  ['ARTO.JK', 'Bank Jago', 'Banking'],
  ['BJTM.JK', 'Bank Jatim', 'Banking'],

  // Telecommunications
  ['TLKM.JK', 'Telkom Indonesia', 'Telecommunications'],
  ['EXCL.JK', 'XL Axiata', 'Telecommunications'],
  ['ISAT.JK', 'Indosat Ooredoo Hutchison', 'Telecommunications'],

  // Consumer Staples
  ['ICBP.JK', 'Indofood CBP Sukses Makmur', 'Consumer Staples'],
  ['INDF.JK', 'Indofood Sukses Makmur', 'Consumer Staples'],
  ['UNVR.JK', 'Unilever Indonesia', 'Consumer Staples'],
  ['MYOR.JK', 'Mayora Indah', 'Consumer Staples'],
  ['ULTJ.JK', 'Ultra Jaya Milk', 'Consumer Staples'],
  ['CPIN.JK', 'Charoen Pokphand Indonesia', 'Consumer Staples'],
  ['JPFA.JK', 'Japfa Comfeed Indonesia', 'Consumer Staples'],

  // Consumer Discretionary
  ['ASII.JK', 'Astra International', 'Automotive'],
  ['AUTO.JK', 'Astra Otoparts', 'Automotive'],
  ['HMSP.JK', 'HM Sampoerna', 'Consumer Goods'],
  ['GGRM.JK', 'Gudang Garam', 'Consumer Goods'],
  ['SIDO.JK', 'Industri Jamu Sido Muncul', 'Healthcare'],

  // Energy
  ['PGAS.JK', 'Perusahaan Gas Negara', 'Energy'],
  ['AKRA.JK', 'AKR Corporindo', 'Energy'],
  ['MEDC.JK', 'Medco Energi', 'Energy'],
  ['PTBA.JK', 'Bukit Asam', 'Mining'],
  ['ADRO.JK', 'Adaro Energy Indonesia', 'Mining'],
  ['INDY.JK', 'Indika Energy', 'Mining'],
  ['BUMI.JK', 'Bumi Resources', 'Mining'],
  ['ITMG.JK', 'Indo Tambangraya Megah', 'Mining'],
  ['HRUM.JK', 'Harum Energy', 'Mining'],

  // Materials & Cement
  ['SMGR.JK', 'Semen Indonesia', 'Materials'],
  ['INTP.JK', 'Indocement Tunggal Prakarsa', 'Materials'],
  ['TPIA.JK', 'Chandra Asri Petrochemical', 'Materials'],
  ['BRPT.JK', 'Barito Pacific', 'Materials'],
  ['INKP.JK', 'Indah Kiat Pulp & Paper', 'Materials'],
  ['TKIM.JK', 'Tjiwi Kimia', 'Materials'],

  // Healthcare
  ['KLBF.JK', 'Kalbe Farma', 'Healthcare'],
  ['MIKA.JK', 'Mitra Keluarga Karyasehat', 'Healthcare'],
  ['SIDO.JK', 'Sido Muncul', 'Healthcare'],
  ['PRGO.JK', 'Prodia Widyahusada', 'Healthcare'],
  ['HEAL.JK', 'Medikaloka Hermina', 'Healthcare'],

  // Property & Real Estate
  ['BSDE.JK', 'Bumi Serpong Damai', 'Property'],
  ['CTRA.JK', 'Ciputra Development', 'Property'],
  ['SMRA.JK', 'Summarecon Agung', 'Property'],
  ['PWON.JK', 'Pakuwon Jati', 'Property'],

  // Infrastructure & Utilities
  ['JSMR.JK', 'Jasa Marga', 'Infrastructure'],
  ['WIKA.JK', 'Wijaya Karya', 'Infrastructure'],
  ['PTPP.JK', 'PP (Pembangunan Perumahan)', 'Infrastructure'],
  ['WSKT.JK', 'Waskita Karya', 'Infrastructure'],

  // Technology
  ['GOTO.JK', 'GoTo Gojek Tokopedia', 'Technology'],
  ['BUKA.JK', 'Bukalapak', 'Technology'],
  ['DMMX.JK', 'Digital Media Nusantara', 'Technology'],
  ['MTDL.JK', 'Metrodata Electronics', 'Technology'],

  // Agriculture & Plantation
  ['AALI.JK', 'Astra Agro Lestari', 'Agriculture'],
  ['LSIP.JK', 'PP London Sumatra', 'Agriculture'],
  ['SIMP.JK', 'Salim Ivomas Pratama', 'Agriculture'],
  ['SSMS.JK', 'Sawit Sumbermas Sarana', 'Agriculture'],

  // Metals & Steel
  ['INCO.JK', 'Vale Indonesia', 'Metals'],
  ['ANTM.JK', 'Aneka Tambang', 'Metals'],
  ['MDKA.JK', 'Merdeka Copper Gold', 'Metals'],
  ['TINS.JK', 'Timah', 'Metals'],

  // Retail
  ['MAPI.JK', 'Mitra Adiperkasa', 'Retail'],
  ['RALS.JK', 'Ramayana Lestari Sentosa', 'Retail'],
  ['LPPF.JK', 'Matahari Department Store', 'Retail'],

  // Media & Entertainment
  ['SCMA.JK', 'Surya Citra Media', 'Media'],
  ['MNCN.JK', 'Media Nusantara Citra', 'Media'],
  ['EMTK.JK', 'Elang Mahkota Teknologi', 'Media'],

  // Logistics & Transportation
  ['TOWR.JK', 'Sarana Menara Nusantara', 'Telecommunications'],
  ['TBIG.JK', 'Tower Bersama', 'Telecommunications'],
  ['BIRD.JK', 'Blue Bird', 'Transportation'],
];

export const SECTOR_AVG_PE: Record<string, number> = {
  Banking: 10,
  Telecommunications: 14,
  'Consumer Staples': 18,
  'Consumer Goods': 20,
  Automotive: 12,
  Healthcare: 22,
  Energy: 10,
  Mining: 8,
  Materials: 12,
  Property: 10,
  Infrastructure: 14,
  Technology: 30,
  Agriculture: 12,
  Metals: 10,
  Retail: 15,
  Media: 12,
  Transportation: 14,
  default: 15,
};

export const SECTOR_AVG_PBV: Record<string, number> = {
  Banking: 1.8,
  Telecommunications: 2.0,
  'Consumer Staples': 3.5,
  'Consumer Goods': 4.0,
  Automotive: 1.5,
  Healthcare: 4.0,
  Energy: 1.2,
  Mining: 1.5,
  Materials: 1.5,
  Property: 1.0,
  Infrastructure: 1.2,
  Technology: 5.0,
  Agriculture: 1.5,
  Metals: 1.5,
  Retail: 2.5,
  Media: 2.0,
  Transportation: 1.5,
  default: 1.5,
};
