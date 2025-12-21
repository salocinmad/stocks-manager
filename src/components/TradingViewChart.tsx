import React, { useEffect, useRef, memo } from 'react';

interface TradingViewChartProps {
    symbol: string;
    theme?: "light" | "dark";
    autosize?: boolean; // Now usually assumed true or handled by container
    height?: number | string;
    width?: number | string;
    watchlist?: string[];
}

// Global definition for TradingView script
declare global {
    interface Window {
        TradingView: any;
    }
}

export const TradingViewChart: React.FC<TradingViewChartProps> = memo(({
    symbol,
    theme = "dark",
    watchlist
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scriptId = 'tradingview-widget-script';

    useEffect(() => {
        // Clean up previous instances inside container if any (though key prop usually handles this)
        if (containerRef.current) {
            containerRef.current.innerHTML = '';
        }

        // Use a stable ID for the symbol to potentially help with browser storage/caching
        const safeSymbol = symbol ? symbol.replace(/[^a-zA-Z0-9]/g, '_') : 'default';
        const containerId = `tv_chart_${safeSymbol}`;

        // Create a div for the widget
        const widgetDiv = document.createElement('div');
        widgetDiv.id = containerId;
        widgetDiv.style.width = '100%';
        widgetDiv.style.height = '100%';
        if (containerRef.current) {
            containerRef.current.appendChild(widgetDiv);
        }

        const initWidget = () => {
            if (window.TradingView) {
                new window.TradingView.widget({
                    "autosize": true,
                    "symbol": symbol,
                    "interval": "D",
                    "timezone": "Etc/UTC",
                    "theme": theme,
                    "style": "1", // Candles
                    "locale": "es",
                    "toolbar_bg": "#f1f3f6",
                    "enable_publishing": false,
                    "allow_symbol_change": true,
                    "container_id": containerId,
                    "details": true,
                    "hotlist": true,
                    "calendar": true,
                    "withdateranges": true,
                    "watchlist": watchlist,
                    "hide_side_toolbar": false
                });
            }
        };

        // Check if script is already loaded
        if (document.getElementById(scriptId)) {
            // Wait a bit if script is loading but window.TradingView is not ready yet
            if (window.TradingView) {
                initWidget();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.TradingView) {
                        clearInterval(checkInterval);
                        initWidget();
                    }
                }, 100);
            }
        } else {
            // Load script
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = initWidget;
            document.head.appendChild(script);
        }

    }, [symbol, theme, watchlist]); // Re-run when these props change

    return (
        <div ref={containerRef} className="tradingview-widget-container w-full h-full" style={{ minHeight: '500px' }} />
    );
});
