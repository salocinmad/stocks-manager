export const getPriceDecimals = (price) => {
  if (!price || price === 0) return 2;
  if (price < 1) {
    return 4;
  }
  if (price < 10) {
    return 3;
  }
  if (price < 100) {
    return 2;
  }
  return 2;
};

export const formatPrice = (price) => {
  if (price === null || price === undefined) return '-';
  const decimals = getPriceDecimals(price);
  return price.toFixed(decimals);
};

export const formatNumberForCSV = (number) => {
  if (number === null || number === undefined || isNaN(number)) return '0,00';
  // Convertir a número por si viene como string
  const num = typeof number === 'string' ? parseFloat(number) : number;

  // Limitar a máximo 3 decimales
  let str = num.toFixed(3);

  // Quitar ceros finales y punto si sobra (ej: 1.500 -> 1.5, 1.000 -> 1)
  if (str.includes('.')) {
    str = str.replace(/\.?0+$/, '');
  }
  return str.replace('.', ',');
};

export const formatCurrency = (value, currencyCode) => {
  if (value === null || value === undefined) return '-';
  const num = parseFloat(value);
  if (isNaN(num)) return '-';

  const formatted = num.toFixed(2);
  const symbol = currencyCode === 'USD' ? '$' : (currencyCode === 'GBP' ? '£' : '€');
  return `${symbol}${formatted}`;
};

export const escapeHtml = (str) => {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const markdownToHtml = (md) => {
  const text = escapeHtml(md);
  let html = text;
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^######\s*(.*)$/gm, '<h6 style="font-size: 14px; font-weight: 600; margin: 12px 0 8px 0;">$1</h6>');
  html = html.replace(/^#####\s*(.*)$/gm, '<h5 style="font-size: 16px; font-weight: 600; margin: 14px 0 8px 0;">$1</h5>');
  html = html.replace(/^####\s*(.*)$/gm, '<h4 style="font-size: 18px; font-weight: 600; margin: 16px 0 10px 0;">$1</h4>');
  html = html.replace(/^###\s*(.*)$/gm, '<h3 style="font-size: 20px; font-weight: 700; margin: 18px 0 10px 0;">$1</h3>');
  html = html.replace(/^##\s*(.*)$/gm, '<h2 style="font-size: 24px; font-weight: 700; margin: 20px 0 12px 0;">$1</h2>');
  html = html.replace(/^#\s*(.*)$/gm, '<h1 style="font-size: 28px; font-weight: 700; margin: 22px 0 14px 0;">$1</h1>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\n-{3,}\n/g, '<hr/>');
  html = html.replace(/\n\n/g, '<br/><br/>');
  html = html.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/^(?:-\s+.*\n?)+/gm, (block) => {
    const items = block.trim().split(/\n/).map(li => li.replace(/^-\s+/, ''));
    return '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
  });
  return html;
};

export const formatExchangeRate = (rate) => {
  if (rate === null || rate === undefined) return '1';
  let num = parseFloat(rate);
  if (isNaN(num)) return '1';
  if (num === 1) return '1';

  // Convertir a string con hasta 12 decimales y quitar ceros
  let str = num.toFixed(12);
  str = str.replace(/\.?0+$/, '');
  return str.replace('.', ',');
};

