'use client';

import { ValuationResult, MethodResult, ValuationVal } from '@/types/stock';
import { Target, BarChart3, Calculator, Receipt, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  valuation: ValuationResult;
  currentPrice: number;
}

interface MethodCardProps {
  label: string;
  result: MethodResult;
  currentPrice: number;
  icon: React.ReactNode;
  color: string;
  desc: string;
}

function MethodCard({ label, result, currentPrice, icon, color, desc }: MethodCardProps) {
  const { value, upside, category } = result;
  
  const isGreen = category === 'UNDERVALUED';
  const isYellow = category === 'FAIR_VALUE';
  const isRed = category === 'OVERVALUED';

  return (
    <div
      className="glass-card flex flex-col justify-between p-5 stat-card"
      style={{ 
        borderColor: isGreen ? 'rgba(34,197,94,0.3)' : isRed ? 'rgba(239,68,68,0.3)' : isYellow ? 'rgba(234,179,8,0.3)' : 'rgba(99,120,175,0.2)',
        background: isGreen ? 'rgba(34,197,94,0.02)' : isRed ? 'rgba(239,68,68,0.02)' : isYellow ? 'rgba(234,179,8,0.02)' : 'rgba(15,23,42,0.6)'
      }}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${color}15`, color }}
            >
              {icon}
            </div>
            <div>
              <span className="text-sm font-bold text-slate-200">
                {label}
              </span>
              <p className="text-[10px] text-slate-500">{desc}</p>
            </div>
          </div>
          {category !== 'INSUFFICIENT_DATA' && (
            <span
              className={clsx(
                "text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider",
                isGreen ? "bg-green-500/20 text-green-400" :
                isYellow ? "bg-yellow-500/20 text-yellow-400" :
                "bg-red-500/20 text-red-400"
              )}
            >
              {isGreen ? 'Undervalued' : isYellow ? 'Fair Value' : 'Overvalued'}
            </span>
          )}
        </div>

        {category !== 'INSUFFICIENT_DATA' && value ? (
           <div className="mt-2">
             <p className="text-xs text-slate-400 mb-1 tracking-wide uppercase">Nilai Intrinsik</p>
             <p className="font-mono text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
               Rp {value.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
             </p>
           </div>
        ) : (
          <div className="py-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Data fundamental tidak cukup
            </p>
          </div>
        )}
      </div>
      
      {category !== 'INSUFFICIENT_DATA' && upside !== null && (
        <div className="mt-4 pt-4 border-t border-slate-700/40 flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400">Potensi Upside</span>
            <span
              className="font-mono text-lg font-bold"
              style={{ color: upside > 0 ? 'var(--green)' : 'var(--red)' }}
            >
              {upside > 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
            </span>
        </div>
      )}
    </div>
  );
}

export function ValuationBreakdown({ valuation, currentPrice }: Props) {
  return (
    <div className="space-y-4">
      {/* Piotroski Specific UI */}
      <div className="glass-card p-5 mb-6 border border-indigo-500/30 bg-indigo-500/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <ShieldCheck size={120} />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <div>
             <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2 mb-1">
                <ShieldCheck size={20} /> Piotroski F-Score
             </h3>
             <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
               Menilai kekuatan finansial berdasarkan 9 kriteria (Profitabilitas, Leverage, dan Efisiensi Operasional).
             </p>
           </div>
           
           <div className="flex flex-col items-end">
              <div className="text-4xl font-black text-slate-100 font-mono flex items-baseline gap-1">
                 {valuation.piotroski.score !== null ? valuation.piotroski.score : '-'}
                 <span className="text-lg text-slate-500">/ 9</span>
              </div>
              {valuation.piotroski.score !== null && (
                <span className={clsx(
                  "text-xs px-2 py-0.5 rounded mt-1 font-bold tracking-wide uppercase",
                  valuation.piotroski.score >= 7 ? "text-green-400" :
                  valuation.piotroski.score >= 4 ? "text-yellow-400" : "text-red-400"
                )}>
                  {valuation.piotroski.score >= 7 ? "Kuat" : valuation.piotroski.score >= 4 ? "Cukup" : "Lemah"}
                </span>
              )}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MethodCard 
          label="DCF Model"
          desc="Discounted Cash Flow 5 Tahun" 
          result={valuation.dcf} 
          currentPrice={currentPrice} 
          icon={<Target size={16} />} 
          color="#3b82f6" 
        />
        <MethodCard 
          label="Graham Number" 
          desc="Perhitungan defensif aset & laba" 
          result={valuation.graham} 
          currentPrice={currentPrice} 
          icon={<Calculator size={16} />} 
          color="#fbbf24" 
        />
        <MethodCard 
          label="Historis P/E (Mean Reversion)" 
          desc="Dibandingkan dengan rata-rata 5 tahun" 
          result={valuation.meanReversion} 
          currentPrice={currentPrice} 
          icon={<BarChart3 size={16} />} 
          color="#a78bfa" 
        />
        <MethodCard 
          label="Dividend Yield Reversion" 
          desc="Berbasis historis deviden 5 tahun" 
          result={valuation.dividendYield} 
          currentPrice={currentPrice} 
          icon={<Receipt size={16} />} 
          color="#34d399" 
        />
      </div>
    </div>
  );
}
