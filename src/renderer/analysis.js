// Everything the analysis UI needs, derived from one account's records.
import { buildCollection } from './luck.js'
import { judge, winRate, POOL_KIND, prepareBanners } from './judge.js'

// Community models of the official rates: flat base rate, then +step per pull from `soft`,
// hard pity at `cap`. Agents match the published 1.6% consolidated rate; the W-Engine curve
// (1%, +6% from 65) gives the published 2.0% and fits real W-Engine records. Bangboo uses
// the same curve.
const MODELS = {
  character: { base: 0.006, soft: 74, step: 0.06, cap: 90 },
  engine: { base: 0.01, soft: 65, step: 0.06, cap: 80 },
}
MODELS.bangboo = MODELS.engine
MODELS.standard = MODELS.character

export function pityModel(kind) {
  const m = MODELS[kind] || MODELS.character
  const pmf = []
  let survive = 1
  for (let n = 1; n <= m.cap; n++) {
    const p = n === m.cap ? 1 : n < m.soft ? m.base : Math.min(1, m.base + m.step * (n - m.soft + 1))
    pmf.push(survive * p)
    survive *= 1 - p
  }
  const mean = pmf.reduce((s, p, i) => s + (i + 1) * p, 0)
  const pastSoft = pmf.slice(m.soft - 1).reduce((a, b) => a + b, 0)
  return { ...m, pmf, mean, pastSoft }
}

// no Capturing Radiance here; kept for the shared components
export const RADIANCE_SINCE = '9999'

const verKey = v => v.split('.').map(Number)
const verCmp = (a, b) => { const x = verKey(a), y = verKey(b); return x[0] - y[0] || (x[1] || 0) - (y[1] || 0) }
const fmtMs = ms => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')

// idJson: src/idJson.json (passed in, so this module also runs under Node for tests)
export function analyse(account, bannerData, { extras = {}, idJson = {} } = {}) {
  const tz = account.region_time_zone ?? 8
  const { pools, issues } = judge(account.result, bannerData, { tz })

  // version of a record by time: the version whose banners had started by then
  const starts = new Map()
  for (const list of Object.values(prepareBanners(bannerData, tz))) {
    for (const b of list) {
      const s = fmtMs(b.s)
      if (!starts.has(b.version) || s < starts.get(b.version)) starts.set(b.version, s)
    }
  }
  const byDate = [...starts].sort((a, b) => verCmp(a[0], b[0]))
  const versionOf = t => { let v = null; for (const [ver, s] of byDate) { if (s <= t) v = ver; else break } return v }

  const perVersion = new Map()
  const entries = account.result instanceof Map ? [...account.result] : account.result
  for (const [key, recs] of entries) {
    if (!POOL_KIND[key]) continue
    for (const r of recs) {
      const v = versionOf(r.time)
      if (!v) continue
      if (!perVersion.has(v)) perVersion.set(v, { version: v, total: 0, pools: {}, fives: [] })
      const e = perVersion.get(v)
      e.total++
      e.pools[key] = (e.pools[key] || 0) + 1
    }
  }
  for (const p of Object.values(pools)) for (const f of p.fives) perVersion.get(versionOf(f.time))?.fives.push(f)

  const character = pools['2']
  const rate = character ? winRate(character.fives) : null
  const versions = [...perVersion.values()].sort((a, b) => verCmp(a.version, b.version))
  for (const v of versions) v.fives.sort((a, b) => (a.time < b.time ? -1 : 1))
  const limited = new Set(bannerData.banners.filter(b => b.channel === 'character').flatMap(b => b.up5))
  // every 5★ / S-rank character, in the account's language, for adding copies obtained outside the gacha
  const names = idJson[account.lang] || idJson['en-us'] || {}
  const characters = Object.entries(names).filter(([id, v]) => id.length === 4 && Number(v.rank_type) === 4)
    .map(([id, v]) => ({ id, name: v.name }))
  const nameOf = id => characters.find(c => c.id === id)?.name
  const collection = buildCollection(pools, f => limited.has(f.itemId), extras, nameOf)
  return { pools, issues, rate, radiance: null, versions, collection, characters }
}
