/**
 * 工行主题色板（canvas 侧）。
 * ECharts 等图表渲染到 canvas，无法解析 var()，因此此处保留字面值。
 * 值必须与 src/app/globals.css 的 --bz-* 令牌保持一致。
 */
export const brand = {
  primary: '#cc0000',
  deep: '#960000',
  soft: '#e02b2b',
  tint: '#fbeeee',
  gold: '#b08a4a',
  goldTint: '#f7f1e6',
  ok: '#1e7b4f',
  okTint: '#edf7f1',
  warn: '#b26a00',
  warnTint: '#fdf4e7',
  danger: '#8c1c13',
  dangerTint: '#fdf0ef',
  info: '#55677a',
  infoTint: '#eef1f4',
  infoBorder: '#cfd6dd',
  textSub: '#5c5150',
  textMuted: '#9a8f8d',
} as const;

export const chartSeries = [
  brand.primary,
  brand.soft,
  brand.info,
  brand.gold,
  brand.ok,
] as const;
