import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, Time, MouseEventParams } from 'lightweight-charts';

interface PnLData {
    time: string;
    value: number;
}

interface PnLChartProps {
    data: PnLData[];
    theme?: 'light' | 'dark';
}

export const PnLChart: React.FC<PnLChartProps> = ({ data, theme = 'dark' }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const isDark = theme === 'dark';
        const backgroundColor = 'transparent';
        const textColor = isDark ? '#d1d5db' : '#374151';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        const crosshairColor = isDark ? '#ffffff' : '#000000';

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor: textColor,
            },
            grid: {
                vertLines: { color: gridColor },
                horzLines: { color: gridColor },
            },
            width: chartContainerRef.current.clientWidth,
            height: 350,
            timeScale: {
                borderColor: isDark ? '#374151' : '#e5e7eb',
                visible: true,
                timeVisible: false,
                secondsVisible: false,
                tickMarkFormatter: (time: number) => {
                    const date = new Date(time * 1000); // lightweight-charts uses seconds sometimes depending on input, but let's trust autoscaling first
                    // Actually, for string dates 'yyyy-mm-dd', it handles them. 
                    // Let's use standard formatter or simple locale
                    return date.toLocaleDateString();
                }
            },
            rightPriceScale: {
                borderColor: isDark ? '#374151' : '#e5e7eb',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
            crosshair: {
                vertLine: {
                    width: 1,
                    color: crosshairColor,
                    style: 3, // Dashed
                    labelBackgroundColor: isDark ? '#374151' : '#9ca3af',
                },
                horzLine: {
                    width: 1,
                    color: crosshairColor,
                    style: 3, // Dashed
                    labelBackgroundColor: isDark ? '#374151' : '#9ca3af',
                },
            },
            localization: {
                locale: 'es-ES', // Set locale for dates
            }
        });

        chartRef.current = chart;

        const baselineSeries = chart.addBaselineSeries({
            baseValue: { type: 'price', price: 0 },
            topLineColor: '#22c55e', // Green
            topFillColor1: 'rgba(34, 197, 94, 0.28)',
            topFillColor2: 'rgba(34, 197, 94, 0.05)',
            bottomLineColor: '#ef4444', // Red
            bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
            bottomFillColor2: 'rgba(239, 68, 68, 0.28)',
            crosshairMarkerVisible: true,
        });

        baselineSeries.setData(data);

        chart.timeScale().fitContent();

        // TOOLTIP LOGIC
        chart.subscribeCrosshairMove((param: MouseEventParams) => {
            if (!tooltipRef.current || !chartContainerRef.current) return;

            if (
                param.point === undefined ||
                !param.time ||
                param.point.x < 0 ||
                param.point.x > chartContainerRef.current.clientWidth ||
                param.point.y < 0 ||
                param.point.y > chartContainerRef.current.clientHeight
            ) {
                tooltipRef.current.style.opacity = '0';
                return;
            }

            // Find price
            const dataPoint = param.seriesData.get(baselineSeries);
            if (!dataPoint) {
                tooltipRef.current.style.opacity = '0';
                return;
            }

            // Format data
            const value = (dataPoint as any).value || (dataPoint as any).close || 0;
            const formattedPrice = new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: 'EUR'
            }).format(value);

            const timestamp = param.time as number; // can be string or no depending on data. If 'yyyy-mm-dd' string is passed, param.time is specialized Time type

            // Safe date formatting
            let dateStr = '';
            if (typeof param.time === 'string') {
                dateStr = param.time;
            } else if (typeof param.time === 'object') {
                const t = param.time as { year: number, month: number, day: number };
                dateStr = `${t.day}/${t.month}/${t.year}`;
            } else {
                dateStr = new Date((param.time as number) * 1000).toLocaleDateString('es-ES');
            }

            // Update Tooltip
            tooltipRef.current.innerHTML = `
                <div class="font-bold text-sm mb-1">${dateStr}</div>
                <div class="text-xs ${value >= 0 ? 'text-green-500' : 'text-red-500'} font-bold">
                    PnL: ${formattedPrice}
                </div>
            `;

            // Positioning
            const tooltipWidth = 120;
            const tooltipHeight = 60;
            let left = param.point.x + 10;
            let top = param.point.y + 10;

            // Boundary checks
            if (left + tooltipWidth > chartContainerRef.current.clientWidth) {
                left = param.point.x - tooltipWidth - 10;
            }
            if (top + tooltipHeight > chartContainerRef.current.clientHeight) {
                top = param.point.y - tooltipHeight - 10;
            }

            tooltipRef.current.style.left = `${left}px`;
            tooltipRef.current.style.top = `${top}px`;
            tooltipRef.current.style.opacity = '1';
        });

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data, theme]);

    return (
        <div className="relative w-full h-full min-h-[350px]">
            <div ref={chartContainerRef} className="w-full h-full" />
            <div
                ref={tooltipRef}
                className="absolute pointer-events-none p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xl opacity-0 transition-opacity duration-150 z-50 text-white"
                style={{ top: 0, left: 0 }}
            />
        </div>
    );
};
