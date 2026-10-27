import { useEffect, useRef } from 'react';
import { createChart, AreaSeries, CandlestickSeries, ColorType } from 'lightweight-charts';
export default function StockChart({ candles, type = 'area', height = 300 }) {
  const container = useRef();
  useEffect(() => {
    if (!container.current || !candles?.length) return;
    const chart = createChart(container.current, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6c7991',
        fontFamily: 'Inter, Segoe UI, sans-serif',
        fontSize: 10,
        attributionLogo: true,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: '#20293a66' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { vertLine: { color: '#7470ba' }, horzLine: { color: '#7470ba' } },
    });
    const series =
      type === 'candles'
        ? chart.addSeries(CandlestickSeries, {
            upColor: '#55c9a2',
            downColor: '#e77788',
            borderVisible: false,
            wickUpColor: '#55c9a2',
            wickDownColor: '#e77788',
          })
        : chart.addSeries(AreaSeries, {
            lineColor: '#9c98ff',
            lineWidth: 2,
            topColor: '#8b86ef35',
            bottomColor: '#8b86ef00',
            priceLineVisible: false,
          });
    series.setData(
      candles.map((c) =>
        type === 'candles'
          ? {
              time: c.time,
              open: c.open / 100,
              high: c.high / 100,
              low: c.low / 100,
              close: c.close / 100,
            }
          : { time: c.time, value: c.close / 100 },
      ),
    );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, type, height]);
  return (
    <div
      ref={container}
      style={{ height, width: '100%' }}
      aria-label="Interactive simulated price chart"
    />
  );
}
