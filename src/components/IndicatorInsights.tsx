'use client';

import { useMemo, useState } from 'react';
import { StockFinancials, ValuationResult, MethodResult } from '@/types/stock';
import { ChevronDown, ChevronUp, Lightbulb, Target } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  financials: StockFinancials;
  valuation: ValuationResult;
}

type Tone = 'positive' | 'neutral' | 'negative';

type InsightItem = {
  id: string;
  title: string;
  valueText: string;
  explanation: string;
  conclusion: string;
  tone: Tone;
};

function formatPct(v: number | null | undefined): string {
  if (typeof v !== 'number' || !isFinite(v)) return 'N/A';
  return `${(v * 100).toFixed(1)}%`;
}

function formatNumber(v: number | null | undefined): string {
  if (typeof v !== 'number' || !isFinite(v)) return 'N/A';
  return v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function methodSignalSummary(methodName: string, method: MethodResult): { valueText: string; conclusion: string; tone: Tone } {
  const upsideText = method.upside !== null ? ` (${formatPct(method.upside)} upside)` : '';

  if (method.category === 'INSUFFICIENT_DATA') {
    return {
      valueText: `Data tidak cukup${upsideText}`,
      conclusion: `${methodName}: belum bisa dipakai sebagai dasar keputusan utama karena data belum cukup.`,
      tone: 'neutral',
    };
  }

  if (method.category === 'UNDERVALUED') {
    return {
      valueText: `Undervalued${upsideText}`,
      conclusion: `${methodName} menilai harga saat ini relatif menarik dibanding nilai wajarnya.`,
      tone: 'positive',
    };
  }

  if (method.category === 'FAIR_VALUE') {
    return {
      valueText: `Fair Value${upsideText}`,
      conclusion: `${methodName} melihat harga sudah mendekati nilai wajarnya, jadi ruang salah harga terbatas.`,
      tone: 'neutral',
    };
  }

  return {
    valueText: `Overvalued${upsideText}`,
    conclusion: `${methodName} mengindikasikan harga sudah relatif mahal dibanding estimasi nilai wajar.`,
    tone: 'negative',
  };
}

function overallConclusion(financials: StockFinancials, valuation: ValuationResult): { summary: string; actionHint: string; tone: Tone } {
  let score = 0;

  if (valuation.recommendation === 'Strong Buy') score += 2;
  else if (valuation.recommendation === 'Buy') score += 1;
  else if (valuation.recommendation === 'Avoid') score -= 2;

  const p = valuation.piotroski.score ?? 0;
  if (p >= 7) score += 1;
  else if (p <= 3) score -= 1;

  if ((valuation.mos ?? 0) > 0.15) score += 1;
  else if ((valuation.mos ?? 0) < 0) score -= 1;

  if (valuation.risk_profile.riskScore <= 40) score += 1;
  else if (valuation.risk_profile.riskScore >= 70) score -= 1;

  if ((financials.freeCashFlow ?? 0) > 0) score += 1;
  else score -= 1;

  if (valuation.data_quality?.flag === 'INCONSISTENT_DATA') score -= 1;

  if (score >= 4) {
    return {
      summary: 'Mayoritas indikator mendukung bahwa saham ini relatif menarik dengan kualitas sinyal yang cukup baik.',
      actionHint: 'Bisa masuk watchlist prioritas tinggi. Tetap cek valuasi terhadap target harga pribadi dan manajemen risiko posisi.',
      tone: 'positive',
    };
  }

  if (score >= 1) {
    return {
      summary: 'Indikator campuran: ada sinyal positif, tetapi masih ada area yang perlu perhatian.',
      actionHint: 'Layak dipantau dulu. Tunggu konfirmasi tambahan (kinerja kuartalan, perbaikan risiko, atau margin of safety yang lebih lebar).',
      tone: 'neutral',
    };
  }

  return {
    summary: 'Banyak indikator belum mendukung keputusan agresif saat ini.',
    actionHint: 'Lebih aman menahan keputusan beli atau menurunkan ukuran posisi sampai kualitas indikator membaik.',
    tone: 'negative',
  };
}

export function IndicatorInsights({ financials, valuation }: Props) {
  const [openId, setOpenId] = useState<string>('overall');

  const items = useMemo<InsightItem[]>(() => {
    const dcf = methodSignalSummary('DCF', valuation.dcf);
    const graham = methodSignalSummary('Graham Number', valuation.graham);
    const meanRev = methodSignalSummary('Mean Reversion PE', valuation.meanReversion);
    const div = methodSignalSummary('Dividend Yield', valuation.dividendYield);

    const roeTone: Tone = (financials.roe ?? -1) >= 0.12 ? 'positive' : (financials.roe ?? -1) >= 0.08 ? 'neutral' : 'negative';
    const deTone: Tone = (financials.debtToEquity ?? 999) <= 80 ? 'positive' : (financials.debtToEquity ?? 999) <= 150 ? 'neutral' : 'negative';
    const fcfTone: Tone = (financials.freeCashFlow ?? -1) > 0 ? 'positive' : 'negative';
    const riskTone: Tone = valuation.risk_profile.riskScore <= 40 ? 'positive' : valuation.risk_profile.riskScore <= 65 ? 'neutral' : 'negative';
    const piotroskiTone: Tone = (valuation.piotroski.score ?? 0) >= 7 ? 'positive' : (valuation.piotroski.score ?? 0) >= 4 ? 'neutral' : 'negative';

    return [
      {
        id: 'mos',
        title: 'Margin of Safety (MOS)',
        valueText: valuation.mos !== null ? formatPct(valuation.mos) : 'N/A',
        explanation: 'MOS menunjukkan seberapa jauh nilai wajar berada di atas harga pasar. Semakin besar MOS, semakin ada bantalan jika asumsi meleset.',
        conclusion: valuation.mos === null
          ? 'MOS belum bisa disimpulkan karena nilai intrinsik belum cukup data.'
          : valuation.mos > 0.2
            ? 'MOS cukup lebar, artinya ruang aman relatif baik.'
            : valuation.mos > 0
              ? 'MOS positif tetapi tidak terlalu lebar, jadi disiplin harga beli tetap penting.'
              : 'MOS negatif, artinya harga pasar sudah di atas nilai wajar versi model.',
        tone: valuation.mos === null ? 'neutral' : valuation.mos > 0.2 ? 'positive' : valuation.mos > 0 ? 'neutral' : 'negative',
      },
      {
        id: 'piotroski',
        title: 'Piotroski F-Score',
        valueText: valuation.piotroski.score !== null ? `${valuation.piotroski.score}/9` : 'N/A',
        explanation: 'Piotroski menilai kesehatan fundamental (profitabilitas, leverage, likuiditas, dan efisiensi operasi).',
        conclusion: valuation.piotroski.score === null
          ? 'Belum bisa menilai kualitas fundamental karena data tidak lengkap.'
          : valuation.piotroski.score >= 7
            ? 'Fundamental tergolong kuat.'
            : valuation.piotroski.score >= 4
              ? 'Fundamental cukup, tetapi belum dominan kuat.'
              : 'Fundamental lemah, risiko value trap meningkat.',
        tone: piotroskiTone,
      },
      {
        id: 'dcf',
        title: 'DCF Model',
        valueText: dcf.valueText,
        explanation: 'DCF menghitung nilai wajar dari proyeksi arus kas masa depan yang didiskonto ke nilai sekarang.',
        conclusion: dcf.conclusion,
        tone: dcf.tone,
      },
      {
        id: 'graham',
        title: 'Graham Number',
        valueText: graham.valueText,
        explanation: 'Graham Number adalah pendekatan konservatif berbasis EPS dan book value per share.',
        conclusion: graham.conclusion,
        tone: graham.tone,
      },
      {
        id: 'meanrev',
        title: 'Mean Reversion (PE Historis)',
        valueText: meanRev.valueText,
        explanation: 'Model ini mengasumsikan valuasi PE cenderung kembali ke rata-rata historis dalam jangka menengah.',
        conclusion: meanRev.conclusion,
        tone: meanRev.tone,
      },
      {
        id: 'dividend',
        title: 'Dividend Yield Reversion',
        valueText: div.valueText,
        explanation: 'Model ini melihat hubungan harga dan yield dividen terhadap kebiasaan historis.',
        conclusion: div.conclusion,
        tone: div.tone,
      },
      {
        id: 'roe',
        title: 'ROE',
        valueText: formatPct(financials.roe),
        explanation: 'ROE mengukur efisiensi perusahaan menghasilkan laba dari modal pemegang saham.',
        conclusion: (financials.roe ?? -1) >= 0.12
          ? 'ROE tinggi, efisiensi modal tergolong baik.'
          : (financials.roe ?? -1) >= 0.08
            ? 'ROE cukup, tetapi belum sangat menonjol.'
            : 'ROE rendah, kemampuan mencetak laba dari modal masih kurang kuat.',
        tone: roeTone,
      },
      {
        id: 'de',
        title: 'Debt to Equity',
        valueText: financials.debtToEquity !== null ? `${(financials.debtToEquity / 100).toFixed(2)}x` : 'N/A',
        explanation: 'Debt to Equity menunjukkan seberapa besar utang dibanding modal sendiri.',
        conclusion: (financials.debtToEquity ?? 999) <= 80
          ? 'Struktur utang relatif sehat.'
          : (financials.debtToEquity ?? 999) <= 150
            ? 'Utang masih wajar, tetapi perlu dipantau.'
            : 'Leverage tinggi, sensitif terhadap tekanan suku bunga dan siklus bisnis.',
        tone: deTone,
      },
      {
        id: 'fcf',
        title: 'Free Cash Flow',
        valueText: formatNumber(financials.freeCashFlow),
        explanation: 'FCF menunjukkan kas bersih yang benar-benar tersisa setelah belanja modal.',
        conclusion: (financials.freeCashFlow ?? -1) > 0
          ? 'FCF positif, laba lebih berkualitas karena didukung kas.'
          : 'FCF negatif, ada risiko kualitas laba dan fleksibilitas keuangan lebih terbatas.',
        tone: fcfTone,
      },
      {
        id: 'risk',
        title: 'Risk Score',
        valueText: `${valuation.risk_profile.riskScore}/100`,
        explanation: 'Risk Score menggabungkan faktor leverage, stabilitas earnings, dan sifat siklikal bisnis.',
        conclusion: valuation.risk_profile.riskScore <= 40
          ? 'Risiko relatif terjaga.'
          : valuation.risk_profile.riskScore <= 65
            ? 'Risiko moderat, butuh disiplin sizing posisi.'
            : 'Risiko tinggi, sebaiknya lebih konservatif.',
        tone: riskTone,
      },
      {
        id: 'quality',
        title: 'Data Quality',
        valueText: valuation.data_quality?.flag ?? 'N/A',
        explanation: 'Data quality menilai kelengkapan data dan konsistensi lintas sumber.',
        conclusion: valuation.data_quality?.flag === 'HIGH_CONFIDENCE'
          ? 'Data cukup andal untuk jadi dasar evaluasi.'
          : valuation.data_quality?.flag === 'MISSING_DATA'
            ? 'Sebagian data kurang lengkap, gunakan keputusan dengan kehati-hatian lebih.'
            : valuation.data_quality?.flag === 'INCONSISTENT_DATA'
              ? 'Ada inkonsistensi data antar sumber, validasi manual sangat disarankan.'
              : 'Belum ada penilaian kualitas data.',
        tone: valuation.data_quality?.flag === 'HIGH_CONFIDENCE' ? 'positive' : valuation.data_quality?.flag ? 'negative' : 'neutral',
      },
    ];
  }, [financials, valuation]);

  const overall = useMemo(() => overallConclusion(financials, valuation), [financials, valuation]);

  return (
    <div className="glass-card p-5">
      <h2 className="text-sm font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Lightbulb size={15} className="text-amber-400" />
        Penjelasan Indikator (Simple)
      </h2>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        Klik setiap indikator untuk melihat penjelasan sederhana dan kesimpulan singkatnya.
      </p>

      <div className="space-y-2 mb-4">
        {items.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div key={item.id} className="rounded-lg border border-slate-700/40 overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? '' : item.id)}
                className="w-full px-3 py-2.5 flex items-center justify-between text-left bg-slate-900/40 hover:bg-slate-800/50 transition-colors"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-200">{item.title}</p>
                  <p className="text-[11px] text-slate-400">Nilai: {item.valueText}</p>
                </div>
                {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>

              {isOpen && (
                <div className="px-3 py-3 bg-slate-900/20 border-t border-slate-700/30 space-y-2">
                  <p className="text-xs text-slate-300">
                    <span className="font-semibold">Penjelasan:</span> {item.explanation}
                  </p>
                  <p className={clsx(
                    'text-xs font-medium rounded-md px-2 py-1.5',
                    item.tone === 'positive' && 'text-green-200 bg-green-500/10 border border-green-500/20',
                    item.tone === 'neutral' && 'text-amber-200 bg-amber-500/10 border border-amber-500/20',
                    item.tone === 'negative' && 'text-red-200 bg-red-500/10 border border-red-500/20',
                  )}>
                    <span className="font-semibold">Kesimpulan:</span> {item.conclusion}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={clsx(
        'rounded-lg border p-3',
        overall.tone === 'positive' && 'border-green-500/30 bg-green-500/10',
        overall.tone === 'neutral' && 'border-amber-500/30 bg-amber-500/10',
        overall.tone === 'negative' && 'border-red-500/30 bg-red-500/10',
      )}>
        <p className="text-xs font-bold mb-1 flex items-center gap-1.5 text-slate-100">
          <Target size={13} className="text-blue-300" />
          Kesimpulan Keseluruhan
        </p>
        <p className="text-xs text-slate-200 mb-1">{overall.summary}</p>
        <p className="text-xs text-slate-300">Saran: {overall.actionHint}</p>
      </div>
    </div>
  );
}
