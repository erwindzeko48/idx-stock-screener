'use client';

import { ValuationResult, MethodResult } from '@/types/stock';
import { Target, BarChart3, Calculator, Receipt, ShieldCheck, AlertTriangle, ArrowUpRight, ArrowDownRight, Activity, TrendingUp, Info, PieChart, Layers, Gauge } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

interface Props {
  valuation: ValuationResult;
  currentPrice: number;
}

function SectionHeading({ icon: Icon, title, desc }: { icon: any, title: string, desc?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
        <Icon size={18} className="text-blue-400" /> {title}
      </h3>
      {desc && <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">{desc}</p>}
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-flex items-center ml-1.5 align-middle">
      <Info size={12} className="text-slate-500 cursor-help hover:text-blue-400 transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-slate-200 text-xs rounded-lg border border-slate-700 shadow-xl z-50 pointer-events-none text-center font-normal normal-case tracking-normal">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Method Card Component (Used in Advanced Panel)
// ─────────────────────────────────────────────────────────────────────────────
function MethodCard({ label, result, currentPrice, icon, color, desc }: { label: string, result: MethodResult, currentPrice: number, icon: React.ReactNode, color: string, desc: string }) {
  const { value, upside, category, confidence, weight, reasoning } = result;
  
  const isGreen = category === 'UNDERVALUED';
  const isYellow = category === 'FAIR_VALUE';
  const isRed = category === 'OVERVALUED';
  const isInvalid = category === 'INSUFFICIENT_DATA' || weight === 0;

  return (
    <div
      className={clsx(
        "bg-slate-900/50 rounded-xl p-4 transition-all relative overflow-hidden border border-slate-700/50",
        isInvalid ? "opacity-50 grayscale" : ""
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800" style={{ color }}>{icon}</div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">{label}</h4>
            <p className="text-[10px] text-slate-500">{desc}</p>
          </div>
        </div>
      </div>
      
      {!isInvalid && value ? (
        <div className="flex justify-between items-end mt-2">
           <div>
             <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Intrinsic Value</p>
             <p className="font-mono text-xl font-bold text-slate-200">Rp {Math.round(value).toLocaleString('id-ID')}</p>
           </div>
           <div className="text-right">
             <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Upside</p>
             <p className={clsx("font-mono font-bold text-sm", (upside || 0) > 0 ? "text-green-400" : "text-red-400")}>
               {(upside || 0) > 0 ? '+' : ''}{((upside || 0) * 100).toFixed(1)}%
             </p>
           </div>
        </div>
      ) : (
        <div className="py-2"><p className="text-xs text-slate-500">{weight === 0 ? 'Filtered logic (w=0)' : 'Insufficient data'}</p></div>
      )}
      <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400 italic">
        {reasoning}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export function ValuationBreakdown({ valuation, currentPrice }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isBuy = valuation.recommendation.includes('Buy');
  const isAvoid = valuation.recommendation === 'Avoid';

  const regimeColors = {
    BULL: 'border-green-500/30 text-green-400 bg-green-500/10',
    BEAR: 'border-red-500/30 text-red-400 bg-red-500/10',
    SIDEWAYS: 'border-slate-500/30 text-slate-300 bg-slate-500/10'
  };

  const recColors = {
    'Strong Buy': 'bg-green-500 text-slate-900 shadow-[0_0_20px_rgba(34,197,94,0.3)]',
    'Buy': 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50',
    'Hold': 'bg-slate-700 text-slate-300 border border-slate-600',
    'Avoid': 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
  };

  const whyNotStrongBuy = [];
  if (valuation.recommendation === 'Buy' || valuation.recommendation === 'Hold') {
    if (valuation.risk > 0.3) whyNotStrongBuy.push('Risiko Moderat/Tinggi.');
    if (valuation.momentum_score < 0.4) whyNotStrongBuy.push('Momentum harga lemah (Sideways/Downtrend).');
    if ((valuation.mos || 0) < 0.25) whyNotStrongBuy.push('Margin of Safety di bawah 25%.');
    if (valuation.confidence < 0.5) whyNotStrongBuy.push('Kepastian proyeksi riwayat mesin rendah.');
  }

  const confText = valuation.confidence >= 0.7 ? 'High Confidence' : valuation.confidence >= 0.4 ? 'Medium Confidence' : 'Low Confidence';
  const confColor = valuation.confidence >= 0.7 ? 'text-blue-400 border-blue-400/30 bg-blue-400/10' : valuation.confidence >= 0.4 ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' : 'text-slate-400 border-slate-400/30 bg-slate-400/10';

  return (
    <div className="space-y-6">
      
      {/* 1. HERO PANEL */}
      <div className="glass-card p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden rounded-2xl border-t-4"
        style={{ borderTopColor: isBuy ? '#22c55e' : isAvoid ? '#ef4444' : '#64748b' }}
      >
        <div className="absolute -right-20 -top-20 opacity-5 pointer-events-none">
          <Target size={300} />
        </div>

        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-3 mb-3">
             <span className={clsx("px-3 py-1.5 rounded-md text-sm font-black uppercase tracking-widest flex items-center gap-1.5", recColors[valuation.recommendation])}>
               {isBuy ? <TrendingUp size={16} /> : isAvoid ? <ArrowDownRight size={16} /> : <Activity size={16} />}
               {valuation.recommendation}
             </span>
              <span className={clsx("px-2 py-1 text-[10px] font-bold rounded-md border uppercase tracking-wider", regimeColors[valuation.market_regime])}>
               {valuation.market_regime} REGIME
             </span>
             <span className={clsx("px-2 py-1 text-[10px] font-bold rounded-md border tracking-wider", confColor)}>
               {confText} ({(valuation.confidence * 100).toFixed(0)}%)
             </span>
          </div>
          
          <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase mb-1">Composite Intrinsic Value</p>
          <div className="flex items-baseline gap-4">
            <h1 className="text-5xl font-black font-mono text-white tracking-tight">
              {valuation.intrinsic_value ? `Rp ${Math.round(valuation.intrinsic_value).toLocaleString('id-ID')}` : 'N/A'}
            </h1>
            {valuation.mos !== null && (
              <span className={clsx("text-xl font-bold rounded-lg px-2 py-1", valuation.mos > 0 ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10")}>
                {valuation.mos > 0 ? '+' : ''}{(valuation.mos * 100).toFixed(1)}% MOS
              </span>
            )}
          </div>
        </div>

        <div className="relative z-10 flex gap-4 md:flex-col lg:flex-row w-full md:w-auto">
           <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 flex-1 min-w-[140px] text-center backdrop-blur-sm">
             <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-1 font-semibold">
               Final Rank Score <Tooltip text="Skor mutakhir hibrid. 70% Fundamental + 30% Momentum." />
             </p>
             <p className="text-3xl font-black font-mono text-blue-400">{(valuation.final_rank_score * 100).toFixed(0)}</p>
           </div>
           <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 flex-1 min-w-[140px] text-center backdrop-blur-sm">
             <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-1 font-semibold">
               Valuation Score <Tooltip text="Murni perhitungan nilai intrinsik, Margin of Safety, dan Quality F-Score." />
             </p>
             <p className="text-3xl font-black font-mono text-slate-200">{(valuation.final_score * 100).toFixed(0)}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 2. SCORE DRIVER PANEL */}
        <div className="glass-card p-6 lg:col-span-2 flex flex-col justify-center">
          <SectionHeading icon={Layers} title="Score Drivers" desc="Anatomi pembentuk Final Rank Score berdasarkan parameter bobot dinamis." />
          
          <div className="space-y-5">
            {/* Composition Bar */}
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 uppercase font-semibold mb-2 px-1">
                <span className="flex items-center">Value (MOS) <Tooltip text="Jarak kelonggaran harga antara nilai pasar dan nilai wajar instrisik (Nilai Asli perusahaan)." /></span>
                <span className="flex items-center">Confidence <Tooltip text="Bobot keyakinan logaritma mesin terhadap akurasi fundamental masa lalu perusahaan." /></span>
                <span className="flex items-center">Quality <Tooltip text="Proteksi F-Score Piotroski untuk menyaring risiko kebangkrutan operasional." /></span>
                <span className="text-red-400 flex items-center">Risk Limit <Tooltip text="Penalti progresif jika ditemukan cacat metrik seperti lonjakan laba fiktif atau utang tinggi." /></span>
              </div>
              <div className="h-3 w-full bg-slate-800 rounded-full flex overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${valuation.mos_normalized * 40}%` }} title="Margin of Safety" />
                <div className="bg-blue-500 h-full transition-all opacity-80" style={{ width: `${valuation.confidence * 25}%` }} title="Confidence" />
                <div className="bg-purple-500 h-full transition-all opacity-80" style={{ width: `${valuation.quality * 20}%` }} title="Quality" />
                <div className="bg-red-500 h-full transition-all opacity-60" style={{ width: `${valuation.risk * 15}%` }} title="Risk Penalty" />
              </div>
            </div>

            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
               <ul className="space-y-2 mb-3">
                 {valuation.explanation?.map((reason, i) => (
                   <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                     <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                     {reason}
                   </li>
                 ))}
                 {(!valuation.explanation || valuation.explanation.length === 0) && <li className="text-slate-500 text-xs italic">Valuasi dihitung menggunakan bobot default.</li>}
               </ul>

               {whyNotStrongBuy.length > 0 && (
                 <div className="mt-3 pt-3 border-t border-slate-800/80">
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Penahan Sinyal Strong Buy:</p>
                   <ul className="space-y-1.5">
                     {whyNotStrongBuy.map((reason, i) => (
                       <li key={`not-${i}`} className="flex items-start gap-2 text-xs text-slate-400">
                         <span className="mt-1 w-1 h-1 rounded-full bg-slate-600 shrink-0" />
                         {reason}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* 3. STABILITY & MOMENTUM PANEL */}
        <div className="glass-card p-6 flex flex-col justify-center gap-6">
           <div>
             <div className="flex justify-between items-end mb-2">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Gauge size={16} className="text-teal-400" /> Momentum
                  <Tooltip text="Sinyal rotasi harga ke atas rata-rata sentimen institusional 6 hingga 12 bulan terakhir." />
                </h4>
                <span className="font-mono text-lg font-black text-teal-400">{(valuation.momentum_score * 100).toFixed(0)}</span>
             </div>
             <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
               <div className="bg-teal-400 h-full rounded-full" style={{ width: `${valuation.momentum_score * 100}%` }} />
             </div>
             <p className="text-[10px] text-slate-500 mt-1 uppercase">Akselerasi historis 12 bulan (Overlay Sentimen).</p>
           </div>
           
           <div>
             <div className="flex justify-between items-end mb-2">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <PieChart size={16} className="text-amber-400" /> Stability
                  <Tooltip text="Derajat konsistensi (rendah fluktuasi) rekam jejak Laba Bersih & Arus Kas perusahaan." />
                </h4>
                <span className="font-mono text-lg font-black text-amber-400">{(valuation.stability_score * 100).toFixed(0)}</span>
             </div>
             <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
               <div className="bg-amber-400 h-full rounded-full" style={{ width: `${valuation.stability_score * 100}%` }} />
             </div>
             <p className="text-[10px] text-slate-500 mt-1 uppercase">Konsistensi Return EPS & FCF 5 Tahun.</p>
           </div>
        </div>

      </div>

      {(valuation.risk > 0.4 || (valuation.warnings?.length || 0) > 0) && (
        <div className="p-6 rounded-2xl border border-red-500/30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-900/20 via-slate-900/60 to-slate-900/60 shadow-lg relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
             <AlertTriangle size={150} />
           </div>
           <SectionHeading icon={AlertTriangle} title="Risk Matrix Analysis" desc="Penalti atau bendera peringatan kuantitatif yang membahayakan posisi jangka panjang." />
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
             {valuation.warnings?.map((warn, i) => (
               <div key={i} className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 p-3 rounded-lg text-sm text-red-200">
                 <AlertTriangle size={16} className="text-red-400 shrink-0" />
                 {warn}
               </div>
             ))}
           </div>
        </div>
      )}

      {/* 5. ADVANCED COLLAPSIBLE PANEL */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-700/50">
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-5 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3 text-slate-300">
            <Calculator size={18} className="text-indigo-400" />
            <span className="font-bold text-sm tracking-wide">Rincian Model Valuasi Lanjut (Advanced Metrik)</span>
          </div>
          <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">{showAdvanced ? 'Tutup' : 'Buka'}</span>
        </button>
        
        {showAdvanced && (
          <div className="p-6 border-t border-slate-800 bg-slate-900/30">
             
             {/* Factor Exposure Focus */}
             <div className="mb-8">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Factor Exposure</h4>
               <div className="grid grid-cols-3 gap-4">
                 <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                   <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Value Factor</p>
                   <div className="flex items-center gap-2">
                     <div className="flex-1 bg-slate-800 h-1.5 rounded-full"><div className="bg-blue-400 h-full rounded-full" style={{ width: `${valuation.factor_exposure.value * 100}%` }} /></div>
                     <span className="text-xs font-mono text-slate-300">{(valuation.factor_exposure.value * 100).toFixed(0)}</span>
                   </div>
                 </div>
                 <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                   <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Growth Factor</p>
                   <div className="flex items-center gap-2">
                     <div className="flex-1 bg-slate-800 h-1.5 rounded-full"><div className="bg-green-400 h-full rounded-full" style={{ width: `${valuation.factor_exposure.growth * 100}%` }} /></div>
                     <span className="text-xs font-mono text-slate-300">{(valuation.factor_exposure.growth * 100).toFixed(0)}</span>
                   </div>
                 </div>
                 <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                   <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Quality Factor</p>
                   <div className="flex items-center gap-2">
                     <div className="flex-1 bg-slate-800 h-1.5 rounded-full"><div className="bg-purple-400 h-full rounded-full" style={{ width: `${valuation.factor_exposure.quality * 100}%` }} /></div>
                     <span className="text-xs font-mono text-slate-300">{(valuation.factor_exposure.quality * 100).toFixed(0)}</span>
                   </div>
                 </div>
               </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
               <MethodCard label="DCF Model" desc="Discounted Cash Flow Multi-Stage" result={valuation.dcf} currentPrice={currentPrice} icon={<Target size={16} />} color="#3b82f6" />
               <MethodCard label="Graham Number" desc="Nilai likuidasi defensif" result={valuation.graham} currentPrice={currentPrice} icon={<Calculator size={16} />} color="#fbbf24" />
               <MethodCard label="PE Mean Reversion" desc="Siklus valuasi historis" result={valuation.meanReversion} currentPrice={currentPrice} icon={<BarChart3 size={16} />} color="#a78bfa" />
               <MethodCard label="Dividend Yield Reversion" desc="Proyeksi berbasis dividen" result={valuation.dividendYield} currentPrice={currentPrice} icon={<Receipt size={16} />} color="#34d399" />
             </div>
          </div>
        )}
      </div>

      <div className="text-center pt-8 pb-4 border-t border-slate-800/50 mt-12">
        <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5 leading-relaxed max-w-2xl mx-auto">
          <Info size={14} className="text-slate-600 shrink-0" />
          <strong>Not Financial Advice:</strong> Seluruh hasil analisis bersumber dari algoritma kuantitatif evaluasi historis dan tidak menggaransi imbal hasil pada kenyataan mendatang. Proyeksi ini berfungsi sebagai pemindai, bukan perintah trading mutlak. Lakukan riset mandiri.
        </p>
      </div>

    </div>
  );
}
