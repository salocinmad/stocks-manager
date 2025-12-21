
import React, { useState } from 'react';
import { Header } from '../components/Header';
import { MyInvestorImport } from './importers/MyInvestorImport';

export const ImportersScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'myinvestor' | 'ibkr' | 'degiro'>('myinvestor');

    return (
        <main className="flex-1 overflow-y-auto w-full p-6 md:p-10 lg:px-16 flex flex-col gap-10 bg-background-light dark:bg-background-dark">
            <Header title="Centro de Importación" />

            <div className="max-w-7xl mx-auto w-full flex flex-col gap-8">

                {/* Tabs Navigation */}
                <div className="flex flex-wrap gap-2 md:gap-4 border-b border-border-light dark:border-border-dark pb-1">
                    <button
                        onClick={() => setActiveTab('myinvestor')}
                        className={`px-6 py-3 rounded-t-2xl font-bold text-sm md:text-base transition-all flex items-center gap-2 ${activeTab === 'myinvestor'
                                ? 'bg-primary text-black shadow-[0_-4px_10px_rgba(252,233,3,0.1)] translate-y-[1px]'
                                : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                    >
                        <span className="material-symbols-outlined">account_balance</span>
                        MyInvestor
                    </button>

                    <button
                        disabled
                        className="px-6 py-3 rounded-t-2xl font-bold text-sm md:text-base transition-all flex items-center gap-2 opacity-40 cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined">query_stats</span>
                        Interactive Brokers
                        <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full ml-1">Pronto</span>
                    </button>

                    <button
                        disabled
                        className="px-6 py-3 rounded-t-2xl font-bold text-sm md:text-base transition-all flex items-center gap-2 opacity-40 cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined">trending_up</span>
                        DeGiro
                        <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full ml-1">Pronto</span>
                    </button>
                </div>

                {/* Tab Content Area */}
                <div className="min-h-[500px]">
                    {activeTab === 'myinvestor' && (
                        <div className="animate-fade-in">
                            <MyInvestorImport />
                        </div>
                    )}
                </div>

            </div>
        </main>
    );
};
