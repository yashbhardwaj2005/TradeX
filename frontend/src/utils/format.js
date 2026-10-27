export const money = (paise = 0, decimals = 2) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(paise / 100);
export const number = (value = 0) => new Intl.NumberFormat('en-IN').format(value);
export const percent = (value = 0) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
export const dateTime = (value) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
export const shortSymbol = (symbol) => symbol?.replace('.NSE', '');
