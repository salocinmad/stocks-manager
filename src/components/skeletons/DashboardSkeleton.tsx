import React from 'react';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col gap-8 p-6 md:p-10 max-w-[1600px] mx-auto w-full animate-pulse">

            {/* Top Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-32 rounded-3xl bg-gray-200 dark:bg-white/5 border border-transparent dark:border-white/5 shadow-sm"></div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
                {/* Main Chart Area */}
                <div className="lg:col-span-2 bg-gray-200 dark:bg-white/5 rounded-3xl h-full border border-transparent dark:border-white/5 shadow-sm"></div>

                {/* Side Panel / Sector Chart */}
                <div className="flex flex-col gap-6 h-full">
                    <div className="flex-1 bg-gray-200 dark:bg-white/5 rounded-3xl border border-transparent dark:border-white/5 shadow-sm"></div>
                    <div className="h-40 bg-gray-200 dark:bg-white/5 rounded-3xl border border-transparent dark:border-white/5 shadow-sm"></div>
                </div>
            </div>

            {/* Bottom Table Area */}
            <div className="h-64 bg-gray-200 dark:bg-white/5 rounded-3xl border border-transparent dark:border-white/5 shadow-sm"></div>
        </div>
    );
};
