import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const PnLChart = ({ data, theme }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
        if (!data || data.length === 0 || !chartContainerRef.current) return;

        // Remove existing chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 300,
            layout: {
                background: { color: 'transparent' },
                textColor: theme === 'dark' ? '#9ca3af' : '#475569',
            },
            grid: {
                vertLines: { color: theme === 'dark' ? '#1f2937' : '#e5e7eb' },
                horzLines: { color: theme === 'dark' ? '#1f2937' : '#e5e7eb' },
            },
            crosshair: {
                mode: 1,
            },
            timeScale: {
                borderColor: theme === 'dark' ? '#404040' : '#cbd5e1',
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: theme === 'dark' ? '#404040' : '#cbd5e1',
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
            },
            handleScale: {
                mouseWheel: true,
                pinch: true,
            },
        });

        chartRef.current = chart;

        // Convert data to lightweight-charts format
        const formattedData = data.map(item => {
            const date = new Date(item.date);
            const time = Math.floor(date.getTime() / 1000);
            return {
                time,
                value: item.pnlEUR || 0
            };
        }).sort((a, b) => a.time - b.time);

        // Add area series
        const series = chart.addAreaSeries({
            topColor: 'rgba(96, 165, 250, 0.4)',
            bottomColor: 'rgba(96, 165, 250, 0.0)',
            lineColor: '#60a5fa',
            lineWidth: 2,
        });

        series.setData(formattedData);
        chart.timeScale().fitContent();

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [data, theme]);

    if (!data || data.length === 0) {
        return <p style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No hay datos disponibles</p>;
    }

    return <div ref={chartContainerRef} style={{ width: '100%', height: '300px' }} />;
};

export default PnLChart;
