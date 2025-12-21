
export interface StockAsset {
  symbol: string;
  name: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  change: number;
  category: 'Stock' | 'ETF' | 'Crypto';
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  date: string;
  source: string;
}

export interface MarketAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  price: number;
  isActive: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}
