'use client';

import { useState } from 'react';
import { Target, TrendingUp, AlertTriangle, PlayCircle } from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import clsx from 'clsx';

interface BacktestGroupResult {
  group: string;
  count: number;
  cagr: number;
  hitRatio: number;
  maxDrawdown: number;
  sharpe: number;
}

interface BacktestResponse {
  eras: string[];
  totalProcessed: number;
  results: Record<string, BacktestGroupResult[]>;
  error?: string;
}

export default function BacktestPortfolioPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BacktestResponse | null>(null);

  const runBacktest = async () => {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch('/api/portfolio-backtest');
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      <div className="mb-0">
        <h1 className="text-3xl font-black text-slate-100 tracking-tight flex items-center gap-3">
          Advanced Portfolio Simulator <span className="text-sm font-normal px-2.5 py-1 rounded bg-purple-500/20 text-purple-400">Rolling Windows</span>
        </h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Simulasi siklus kuantitatif (Momentum, Stability, Market Regime) pada pergerakan Top 15 Bluechips secara retroaktif melintasi banyak era krisis dan booming.
        </p>
      </div>

      {!data && !loading && (
        <div className="glass-card p-12 text-center border-dashed border-2 border-slate-700/50">
          <Target className="mx-auto text-slate-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-slate-200">Jalankan Uji Gulir (Rolling Era Backtest)</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Sistem akan melompat ke masa lalu (2018, 2020, dan 2022) mengumpulkan data pra-market sebelum setiap periode dimulai, memilah ranking, lalu menghitung Sharpe Ratio selama hold 2 tahun ke depan. Memakan waktu hingga 10 detik.
          </p>
          <button
            onClick={runBacktest}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 mx-auto"
          >
            <PlayCircle size={18} /> Eksekusi Time Travel
          </button>
        </div>
      )}

      {loading && (
        <div className="glass-card p-12 text-center">
           <div className="flex justify-center mb-6">
             <div className="w-12 h-12 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
           </div>
           <p className="text-lg font-bold text-slate-300">Menyusun Ulang Sejarah Pasar Modal...</p>
           <p className="text-slate-500 mt-2">Menelusuri 3 zaman, meracik koefisien momentum. Jangan tutup halaman ini.</p>
        </div>
      )}

      {data && !loading && !data.error && (
        <div className="space-y-12">
          {data.eras.map((era) => {
            const eraResults = data.results[era] || [];
            return (
              <div key={era} className="space-y-4">
                <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
                  <TrendingUp className="text-blue-400" /> Hasil Simulasi: {era}
                </h2>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {eraResults.map((gr) => {
                    const isGood = gr.group === 'Strong Buy' || gr.group === 'Buy';
                    const isBad = gr.group === 'Avoid';
                    
                    return (
                      <div key={gr.group} className="glass-card p-6 border-t-4"
                        style={{ borderTopColor: isGood ? '#22c55e' : isBad ? '#ef4444' : '#eab308' }}
                      >
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-4">Grup {gr.group}</p>
                        
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercas tracking-wide">Rata-Rata Return (CAGR)</p>
                            <p className={clsx("text-3xl font-black font-mono", gr.cagr >= 0 ? "text-green-400" : "text-red-400")}>
                              {gr.cagr > 0 ? '+' : ''}{gr.cagr.toFixed(1)}%
                            </p>
                          </div>

                          <div className="flex justify-between border-t border-slate-800 pt-3">
                             <div>
                               <p className="text-[10px] text-slate-500">Sharpe</p>
                               <p className="text-sm font-bold text-slate-300 font-mono">{gr.sharpe.toFixed(2)}</p>
                             </div>
                             <div className="text-right">
                               <p className="text-[10px] text-slate-500">Max DD</p>
                               <p className="text-sm font-bold text-red-400 font-mono">-{gr.maxDrawdown.toFixed(1)}%</p>
                             </div>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 text-center mt-2">[{gr.count} Saham | {gr.hitRatio.toFixed(0)}% Hit]</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 mb-4 text-sm text-indigo-200">
            <strong>Catatan Model Kuantitatif:</strong> Hasil iterasi di atas dihitung melalui metode agregasi <em>Dynamic Final Rank Score</em> yang memadukan Skor Nilai Intrinsik (70%) dengan Momentum 12-Bulan Lintas-Sektor (30%). Mesin Market Regime berupaya mendeteksi arah pasar menggunakan Golden Cross/Death Cross untuk menyesuaikan agresivitas Margin of Safety. Uji sampel dilakukan terhadap 15 saham Bluechip.
          </div>
        </div>
      )}

      {data?.error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-3">
          <AlertTriangle size={24} />
          <p>Terjadi kesalahan integrasi Engine: {data.error}</p>
        </div>
      )}
    </div>
  );
}
