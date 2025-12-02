import React from 'react';
import './CalendarHeatmap.css';

/**
 * Calendar Heatmap Component
 * Visualizes daily PnL performance in a GitHub-style contribution graph
 */
function CalendarHeatmap({ data = [], theme = 'dark' }) {
    if (!data || data.length === 0) {
        return (
            <div className="heatmap-empty">
                <p>No hay datos suficientes para mostrar el mapa de calor</p>
            </div>
        );
    }

    // Group data by month and week
    const monthsData = {};
    data.forEach(item => {
        const date = new Date(item.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthsData[monthKey]) {
            monthsData[monthKey] = [];
        }

        monthsData[monthKey].push({
            date: item.date,
            value: item.value,
            day: date.getDate(),
            weekday: date.getDay()
        });
    });

    // Calculate color intensity based on PnL
    const getColor = (value) => {
        if (value === null || value === undefined) return 'var(--heatmap-empty)';

        const maxValue = Math.max(...data.map(d => Math.abs(d.value)));
        const intensity = Math.abs(value) / maxValue;

        if (value > 0) {
            // Green gradient for profits
            if (intensity > 0.75) return '#22c55e';
            if (intensity > 0.5) return '#4ade80';
            if (intensity > 0.25) return '#86efac';
            return '#bbf7d0';
        } else if (value < 0) {
            // Red gradient for losses
            if (intensity > 0.75) return '#ef4444';
            if (intensity > 0.5) return '#f87171';
            if (intensity > 0.25) return '#fca5a5';
            return '#fecaca';
        }
        return 'var(--heatmap-neutral)';
    };

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    return (
        <div className="calendar-heatmap">
            <div className="heatmap-months">
                {Object.entries(monthsData).slice(-6).map(([monthKey, days]) => {
                    const [year, month] = monthKey.split('-');
                    const monthName = monthNames[parseInt(month) - 1];

                    return (
                        <div key={monthKey} className="heatmap-month">
                            <div className="month-label">{monthName}</div>
                            <div className="month-grid">
                                {days.map((day, idx) => (
                                    <div
                                        key={idx}
                                        className="heatmap-cell"
                                        style={{ backgroundColor: getColor(day.value) }}
                                        title={`${day.date}: €${day.value.toFixed(2)}`}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="heatmap-legend">
                <span>Menos</span>
                <div className="legend-colors">
                    <div className="legend-cell" style={{ backgroundColor: '#fecaca' }} />
                    <div className="legend-cell" style={{ backgroundColor: '#fca5a5' }} />
                    <div className="legend-cell" style={{ backgroundColor: 'var(--heatmap-neutral)' }} />
                    <div className="legend-cell" style={{ backgroundColor: '#bbf7d0' }} />
                    <div className="legend-cell" style={{ backgroundColor: '#86efac' }} />
                    <div className="legend-cell" style={{ backgroundColor: '#4ade80' }} />
                    <div className="legend-cell" style={{ backgroundColor: '#22c55e' }} />
                </div>
                <span>Más</span>
            </div>
        </div>
    );
}

export default CalendarHeatmap;
