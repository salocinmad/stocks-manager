
import { StockAsset, NewsItem, MarketAlert } from './types';

export const MOCK_ASSETS: StockAsset[] = [
  { symbol: 'ITX', name: 'Inditex', quantity: 1200, averagePrice: 32.5, currentPrice: 34.5, change: 14.36, category: 'Stock' },
  { symbol: 'SAN', name: 'Banco Santander', quantity: 5000, averagePrice: 3.4, currentPrice: 3.65, change: 7.35, category: 'Stock' },
  { symbol: 'AAPL', name: 'Apple Inc.', quantity: 50, averagePrice: 150.0, currentPrice: 182.63, change: 21.75, category: 'Stock' },
  { symbol: 'VUSA', name: 'Vanguard S&P 500', quantity: 200, averagePrice: 78.0, currentPrice: 85.2, change: 9.23, category: 'ETF' },
];

export const MOCK_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Iberdrola supera previsiones con un beneficio neto de 4.300M€',
    summary: 'La eléctrica española refuerza su posición en renovables con un sólido desempeño trimestral superando las expectativas del consenso de mercado.',
    sentiment: 'Positive',
    date: 'Hace 2 horas',
    source: 'Financial Times'
  },
  {
    id: '2',
    title: 'Inditex ajusta su logística en Asia ante desafíos geopolíticos',
    summary: 'El gigante textil busca alternativas en Vietnam e India para mitigar posibles interrupciones en la cadena de suministro global.',
    sentiment: 'Neutral',
    date: 'Hace 5 horas',
    source: 'Reuters'
  },
  {
    id: '3',
    title: 'Inflación en la Eurozona repunta ligeramente en el último mes',
    summary: 'Los datos preliminares muestran un incremento del 0.2% superior a lo esperado, lo que podría retrasar los recortes de tipos por parte del BCE.',
    sentiment: 'Negative',
    date: 'Hoy, 09:30',
    source: 'Expansión'
  }
];

export const MOCK_ALERTS: MarketAlert[] = [
  { id: '1', symbol: 'TEF', condition: 'below', price: 3.80, isActive: true },
  { id: '2', symbol: 'SAN', condition: 'above', price: 4.00, isActive: false },
];
