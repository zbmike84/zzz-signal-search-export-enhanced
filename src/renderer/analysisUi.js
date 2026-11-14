// Shared bits for the analysis components.

// Result colours: three hues that stay distinguishable under the common colour-vision
// deficiencies. Every use is paired with a text label, never colour alone.
export const COLORS = {
  win: '#1baf7a',
  lose: '#eb6834',
  guar: '#2a78d6',
  neutral: '#a3a9b2',
  bar: '#5d6d86',
}

// '{n} pulls' + { n: 3 } -> '3 pulls'
export const fmt = (s, vars = {}) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))

// result -> [label, colour class]
export function resultInfo(f, kind, text) {
  const r = text.result
  switch (f.result) {
    case 'win': return [r.win, 'win']
    case 'lose': return [r.lose, 'lose']
    case 'guaranteed': return [r.guaranteed, 'guar']
    case 'up': return [r.up, 'win']
    case 'up_guaranteed': return [r.up_guaranteed, 'guar']
    case 'off': return [r.off, 'lose']
    case 'standard': return [r.standard, 'neutral']
    default: return [r.unknown, 'neutral']
  }
}

export function legendFor(kind, text) {
  const l = text.legend
  if (kind === 'character') return [['win', l.win], ['lose', l.lose], ['guar', l.guaranteed]]
  if (kind === 'engine') return [['win', l.weaponUp], ['lose', l.weaponOff], ['guar', l.weaponGuaranteed]]
  return [['neutral', l.standard]]
}

export const POOL_ORDER = ['2', '3', '102', '103', '5', '1']

// Luck tiers on a diverging blue (lucky) - grey - red (unlucky) scale
export const TIER_COLORS = { blessed: '#1c5cab', lucky: '#6da7ec', average: '#c0c4cc', unlucky: '#ec835a', cursed: '#d03b3b' }

// 0.009 -> 'top 0.9%', 0.051 -> 'top 5.1%', 0.3 -> 'top 30%', 0.97 -> 'bottom 3.0%'
// one decimal below 10% so values next to the 5% tier boundary don't round onto it
export function topText(top, text) {
  const lucky = top <= 0.5
  const p = (lucky ? top : 1 - top) * 100
  const s = p < 10 ? p.toFixed(1) : String(Math.round(p))
  return fmt(lucky ? text.fortune.top : text.fortune.bottom, { p: s })
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
