
import React, { useState } from 'react';
import { Header } from '../components/Header';

export const RiskVisualScreen: React.FC = () => {
  const [tp, setTp] = useState(25);
  const [sl, setSl] = useState(10);

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden">
      <Header title="Gestión Visual de Riesgo" />
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <section className="flex-1 p-4 lg:p-8 bg-background-light dark:bg-background-dark flex flex-col overflow-hidden">
          <div className="relative flex-1 bg-white dark:bg-surface-dark rounded-3xl border border-border-light dark:border-border-dark shadow-inner overflow-hidden flex flex-col items-center justify-center group cursor-crosshair">
            {/* Visual simulation */}
            <div className="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
               <span className="material-symbols-outlined text-[300px]">auto_graph</span>
            </div>
            
            <div className="relative w-full h-[300px] flex flex-col gap-1 items-center justify-center z-10">
               <div className="w-[80%] h-0.5 bg-gray-200 dark:bg-white/10 relative">
                  {/* SL Marker */}
                  <div 
                    style={{ left: `${30 - sl}%` }} 
                    className="absolute -top-12 flex flex-col items-center transition-all duration-300"
                  >
                     <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded mb-2">SL: -{sl}%</span>
                     <div className="h-24 w-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                  </div>

                  {/* Entry Marker */}
                  <div className="absolute left-[30%] -top-4 flex flex-col items-center">
                     <div className="h-8 w-0.5 bg-primary"></div>
                     <span className="bg-primary text-black text-[10px] font-bold px-2 py-1 rounded mt-2">ENTRADA</span>
                  </div>

                  {/* TP Marker */}
                  <div 
                    style={{ left: `${30 + tp}%` }} 
                    className="absolute -top-12 flex flex-col items-center transition-all duration-300"
                  >
                     <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded mb-2">TP: +{tp}%</span>
                     <div className="h-24 w-0.5 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                  </div>
               </div>
            </div>

            <p className="text-xs text-text-secondary-light font-medium italic mt-4">Usa los controles laterales para ajustar tus niveles de salida.</p>
          </div>
        </section>

        <aside className="w-full lg:w-[400px] bg-white dark:bg-surface-dark border-l border-border-light dark:border-border-dark p-8 flex flex-col gap-8 overflow-y-auto">
          <div className="flex flex-col gap-2">
             <h2 className="text-2xl font-bold tracking-tight">Telefónica (TEF)</h2>
             <p className="text-sm text-text-secondary-light">Precio actual: 3,89 €</p>
          </div>

          <div className="flex flex-col gap-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="font-bold text-green-500 flex items-center gap-2">
                   <span className="material-symbols-outlined text-sm">trending_up</span> Objetivo (TP)
                </label>
                <span className="text-xl font-mono font-bold">{tp}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={tp}
                onChange={e => setTp(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none accent-green-500 cursor-pointer"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="font-bold text-red-500 flex items-center gap-2">
                   <span className="material-symbols-outlined text-sm">trending_down</span> Stop Loss (SL)
                </label>
                <span className="text-xl font-mono font-bold">{sl}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={sl}
                onChange={e => setSl(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none accent-red-500 cursor-pointer"
              />
            </div>

            <div className="p-6 rounded-2xl bg-gray-50 dark:bg-black/20 flex flex-col gap-4">
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Ratio Riesgo/Beneficio:</span>
                <span className="font-bold text-primary">1 : {(tp / sl).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Pérdida est. (1000€):</span>
                <span className="font-bold text-red-400">-{sl * 10} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Ganancia est. (1000€):</span>
                <span className="font-bold text-green-400">+{tp * 10} €</span>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 flex flex-col gap-3">
             <button className="w-full py-4 rounded-full bg-primary text-black font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                <span>Confirmar Orden</span>
                <span className="material-symbols-outlined">arrow_forward</span>
             </button>
             <p className="text-[10px] text-center opacity-40 uppercase font-bold tracking-widest">Powered by Gemini Risk Engine</p>
          </div>
        </aside>
      </div>
    </main>
  );
};
