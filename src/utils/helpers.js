export const hashString = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

export const hslColor = (hue, s, l) => `hsl(${Math.round(hue % 360)}, ${Math.round(s)}%, ${Math.round(l)}%)`;

export const generatePalette = (n, mode) => {
  const isDark = mode === 'dark';
  const s = isDark ? 72 : 68;
  const l = isDark ? 46 : 56;
  const colors = [];
  for (let i = 0; i < n; i++) {
    const hue = (i * (360 / n)) % 360;
    colors.push(hslColor(hue, s, l));
  }
  return colors;
};

export const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

export const getDispersedIndices = (n) => {
  if (n <= 1) return [0];
  let step = Math.floor(n / 2) + 1;
  while (gcd(n, step) !== 1) step++;
  const order = [];
  for (let i = 0; i < n; i++) order.push((i * step) % n);
  return order;
};

