# Dokumentasi Metodologi & Evaluasi Stock Screener

Dokumen ini menjelaskan rancangan sistem, metode perhitungan, dan langkah-langkah *robustness* (keandalan) yang diterapkan pada aplikasi Stock Screener. Anda dapat menggunakan dokumen ini sebagai acuan untuk mengevaluasi apakah logika pengambilan keputusan dan kalkulasi aplikasi sudah sesuai dengan *best practice* investasi.

---

## 1. Arsitektur & Alur Data

Aplikasi ini menggunakan arsitektur **Next.js (App Router)** dengan alur data sebagai berikut:
1. **Pencarian Data (Fetcher):** Menggunakan pustaka `yahoo-finance2` (`src/lib/fetcher.ts`). Semua anomali pada data mentah (seperti beda format desimal vs persentase pada dividen, atau data historis sektoral yang hilang) distandarisasi dan dibersihkan di tahap ini.
2. **Streaming API (`src/app/api/stocks/stream/route.ts`):** Data emiten diproses satu per satu dan langsung dikirim ke antarmuka klien menggunakan *Server-Sent Events (SSE)* agar *dashboard* merespons secara seketika (*realtime*).
3. **Penyaringan Klien UI (`HealthFilterPanel.tsx`):** Antarmuka memungkinkan pengguna mengatur ambang batas (*threshold*) dari matriks fundamental (ROE, D/E, dll).

---

## 2. Metode Valuasi (Valuation Engines)

Kalkulator valuasi utama berada di `src/lib/engines/valuationEngine.ts`. Sistem menggunakan 5 pilar valuasi. Untuk mencegah satu rasio tidak wajar menghasilkan nilai ekstrem (misalnya, *upside* ribuan persen karena lonjakan EPS sesaat), setiap metode telah diberi "pagar pembatas" (*caps/constraints*).

### A. Discounted Cash Flow (DCF)
Menghitung nilai sekarang (Present Value) dari arus kas bebas di masa depan.
- **Data Primer:** *Free Cash Flow* (FCF), Tingkat Pertumbuhan (*Growth Rate*), dan *Discount Rate* (WACC / Cost of Equity).
- **Proyeksi:** FCF diproyeksikan selama rentang tahun tertentu, lalu ditambahkan *Terminal Value* menggunakan formula *Perpetuity Growth*.
- **Robustness (Keandalan):**
  - Jika FCF negatif, perhitungan DCF diabaikan / diberi bobot rendah secara otomatis.
  - Nilai wajar DCF dibatasi (dicapping) agar tidak memecahkan batas *outlier* yang tidak masuk akal (misalnya maksimal persentase tertentu di atas harga saat ini).

### B. Graham Number
Metode defensif dari Benjamin Graham untuk mencari saham dengan aset kuat dan penghasilan stabil.
- **Rumus Dasar:** `Akar Kuadrat (22.5 × EPS × Book Value per Share)`
- **Robustness (Keandalan):**
  - **Median EPS:** Menggunakan rata-rata tengah (median) dari EPS historis untuk mencegah anomali jika perusahaan baru saja menjual aset dan mencetak EPS fantastis dalam 1 kuartal.
  - Hanya valid jika EPS dan *Book Value* positif.

### C. Piotroski F-Score
Mengukur kesehatan finansial dengan skor 0 hingga 9.
- **Kriteria (Masing-masing bernilai 1 poin):**
  1. *Profitability:* ROA Positif, CFO Positif, CFO > Net Income, Peningkatan ROA (YoY).
  2. *Leverage/Liquidity:* Penurunan Rasio Utang (D/E), Peningkatan Current Ratio, Tidak ada penerbitan saham baru (Dilusi).
  3. *Operating Efficiency:* Peningkatan Gross Margin, Peningkatan Asset Turnover.
- **Robustness (Keandalan):** Validasi ketat (strict null-checks). Jika data YoY hilang, sistem tidak berasumsi perusahaan membaik (poin nol), mencegah skor tinggi palsu.

### D. Mean Reversion (Historical PE)
Berasumsi bahwa PE saat ini perlahan akan kembali ke PE historis rata-ratanya.
- **Perhitungan:** `Historical Median PE × Current EPS` = *Fair Value*
- **Robustness (Keandalan):**
  - PE yang terlalu tinggi (misalnya perusahaan merugi sedikit sehingga PE 1000x) dibatasi maksimal **35x**.
  - Mengabaikan lonjakan PE ekstrem saat perusahaan mengalami anomali harga jangka pendek.

### E. Dividend Yield Reversion
Berasumsi titik *support* harga saham dapat dihitung dari dividennya. (Saham akan dibeli investor saat nilai *yield* deviden cukup menarik, mendorong harganya naik).
- **Perhitungan:** `Dividen per Lembar / Median Historical Yield` = *Fair Value*
- **Robustness (Keandalan):** Jika *yield* saat ini terlalu kecil atau perusahaan tiba-tiba memotong dividen, model ini akan diskon/diabaikan karena deviden tak lagi relevan mem-backup valuasi kapital.

---

## 3. Sistem Skoring & Aggregasi (`scoringEngine.ts`)

Bagaimana 5 metode di atas digabungkan menjadi 1 keputusan beli/jual dan indikasi **Margin of Safety (MoS)**?

1. **Composite Confidence Score:**
   Setiap metode memiliki "bobot kepercayaan". Piotroski yang tinggi meningkatkan *confidence*, sedangkan data hilang memotong *confidence*. Jika *confidence score* < 0.3 (30%), aplikasi akan menyembunyikan *upside %* karena data tidak cukup kuat untuk menilai perusahaan.
2. **Outlier Cap (Pencegah Nilai Ekstrem):**
   Meskipun menggunakan rata-rata terimbang, sistem menetapkan batas keras: **Nilai Wajar Gabungan tidak boleh melebihi 4x harga historis**. Ini mencegah munculnya prediksi keuntungan +900% akibat galat pada laporan keuangan perusahaan kecil (*penny stocks*).
3. **Penetapan Margin of Safety (MoS):**
   Laba yang diisyaratkan (*implied upside*) antara Nilai Wajar Gabungan (Composite Intrinsic Value) berbanding lurus terhadap Harga Penutupan Terakhir (Last Close Price).

---

## 4. Filter Kesehatan Perusahaan Klien (Health Filters)

Di `HealthFilterPanel.tsx`, daftar emiten yang di-streaming akan disaring secara visual.
Filter **Default** yang saat ini aktif (*Enabled by Default*) untuk mendepak kualitas rendah secara otomatis dari pandangan mata:
- **ROE (Return on Equity):** Minimal **> 8%**.
- **FCF (Free Cash Flow):** Harus **Positif**.
- **D/E (Debt to Equity):** Maksimal **< 1.5** (Leverage masuk akal).
- **Net Income:** Harus **Positif** (Perusahaan harus mencetak laba).
- **Revenue Growth:** Minimal **> 3%**.
- **Net Income Growth:** Minimal **> 3%**.
- **Dividend Yield:** Minimal **> 1%**.

*(Catatan: Filter ini diaplikasikan di state klien secara realtime, jadi pengguna tetap memegang kendali untuk mengubah angka-angka ini atau mematikan filternya sesuai toleransi risiko).*

---

## 5. Audit dan Telemetry Data

Untuk transparansi komputasi, API mendistribusikan log pengawasan (Audit Robustness) yang berisi:
- Persentil kinerja skoring (Nilai Tengah p50, p90, dan Tertinggi p99).
- Tingkat kegagalan pengambilan data akibat keterbatasan sumber data Yahoo.

Jika terjadi error pada komponen metrik tunggal, aplikasi dibuat "*fail-safe*"—saham tersebut tetap ditampilkan dengan nilai metrik valid yang tersisa, daripada menggagalkan seluruh antarmuka.

---

### Kesimpulan untuk Evaluator:
Seluruh komputasi telah **dikunci dari nilai ekstrem** melalui teknik statistik (penggunaan *median*, rasio batas atas *caps*), dan difilter pada muatan awal aplikasi menggunakan parameter yang merepresentasikan **perusahaan sangat sehat & bertumbuh** (*Profitable, positive cashflow, low debt*), menyisakan kandidat saham kokoh untuk *Margin of Safety* yang sesungguhnya.
