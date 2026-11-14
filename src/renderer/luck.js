// "How lucky am I", as a percentile among players pulling under the same rules.
// top = share of players who did better than you (ties count half), so
//   top 0.05 -> luckier than 95% of players.
// Purely for fun: it leans on community models of the rates.
//
// Distributions are arrays indexed by value: d[n] = P(X = n).
import { pityModel } from './analysis.js'

// ---- game rules (the only ZZZ-specific part) ------------------------------------

// chance that a non-guaranteed 5★ is a rate-up one; null = no rate-up rule
export const UP_CHANCE = { character: 0.5, engine: 0.75 }
export function upChance(kind) {
  return UP_CHANCE[kind] ?? null
}

// ---- tiers -----------------------------------------------------------------------------

export const TIERS = [
  { key: 'blessed', max: 0.05 },
  { key: 'lucky', max: 0.25 },
  { key: 'average', max: 0.75 },
  { key: 'unlucky', max: 0.95 },
  { key: 'cursed', max: 1 },
]
export const tierOf = top => TIERS.find(t => top <= t.max)?.key ?? 'cursed'

// threshold for "吃满大保底": the loss and the guarantee both ran into soft pity
export const FULL_PITY = 150

// ---- distribution helpers --------------------------------------------------------------

function erf(x) {
  // Abramowitz-Stegun 7.1.26, |error| < 1.5e-7
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a)
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a))
}
const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2))

function convolve(a, b, maxV = Infinity) {
  const n = Math.min(a.length + b.length - 1, maxV + 1)
  const out = new Float64Array(Math.max(n, 1))
  for (let i = 0; i < a.length && i < n; i++) {
    if (!a[i]) continue
    for (let j = 0; j < b.length && i + j < n; j++) out[i + j] += a[i] * b[j]
  }
  return out
}
const cdfAt = (d, x) => { let c = 0; for (let v = 0; v <= x && v < d.length; v++) c += d[v]; return Math.min(1, c) }
function moments(d) {
  let m = 0, v = 0
  d.forEach((p, x) => { m += p * x })
  d.forEach((p, x) => { v += p * (x - m) ** 2 })
  return { mean: m, sd: Math.sqrt(v) }
}

const cache = new Map()
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key) }

// pulls for one 5★
export const pityDist = kind => memo(`pity:${kind}`, () => Float64Array.from([0, ...pityModel(kind).pmf]))

// pulls for one rate-up 5★ when the first 5★ is a q chance at the rate-up: S, or S + S'
export function costDist(kind, q) {
  return memo(`cost:${kind}:${q}`, () => {
    const s = pityDist(kind), ss = convolve(s, s)
    const out = new Float64Array(ss.length)
    s.forEach((p, v) => { out[v] += q * p })
    ss.forEach((p, v) => { out[v] += (1 - q) * p })
    return out
  })
}

// P(first + k-1 copies of `each` <= x); exact up to 40 terms, normal approximation above
function sumCdf(each, k, x, first = each) {
  if (k <= 0) return x >= 0 ? 1 : 0
  if (x < k) return 0
  if (k <= 40) {
    let d = first
    for (let i = 1; i < k; i++) d = convolve(d, each, x)
    return cdfAt(d, x)
  }
  const a = moments(first), b = moments(each)
  const mean = a.mean + (k - 1) * b.mean, sd = Math.sqrt(a.sd ** 2 + (k - 1) * b.sd ** 2)
  return normCdf((x + 0.5 - mean) / sd)
}

// Completed run: k events took exactly S pulls. top = P(S' < S) + P(S' = S) / 2
function sumPercentile(each, k, S, first) {
  const le = sumCdf(each, k, S, first), lt = sumCdf(each, k, S - 1, first)
  return lt + (le - lt) / 2
}

// Open run: k events within T pulls, the run may still be going.
// X = events a random player gets in T pulls; top = P(X > k) + P(X = k) / 2
function countPercentile(each, k, T, first) {
  const ge = sumCdf(each, k, T, first), gt = sumCdf(each, k + 1, T, first)
  return gt + (ge - gt) / 2
}

// ---- metrics ---------------------------------------------------------------------------

// Lifetime 5★ speed: N 5★ in T pulls, T including the pulls since the last 5★.
export function speedLuck(kind, N, T) {
  return { N, T, top: countPercentile(pityDist(kind), N, T) }
}

// One banner's 5★ speed. The pulls end exactly on a 5★, so it is a completed run.
export function bannerSpeed(kind, fives) {
  const N = fives.length, S = fives.reduce((s, f) => s + f.pity, 0)
  return { N, S, top: N ? sumPercentile(pityDist(kind), N, S) : 0.5 }
}

const isUp = f => f.result === 'win' || f.result === 'guaranteed' || f.result === 'up' || f.result === 'up_guaranteed'
const isOffGuaranteed = f => f.result === 'guaranteed' || f.result === 'up_guaranteed'

// Pulls spent on each rate-up 5★ (since the previous rate-up); `open` = pulls after the last one.
export function upCosts(fives) {
  const costs = []
  let acc = 0
  for (const f of fives) {
    acc += f.pity
    if (isUp(f)) { costs.push({ cost: acc, lost: isOffGuaranteed(f), f }); acc = 0 }
  }
  return { costs, open: acc }
}

// One banner's pulls per rate-up. Pulls after the last rate-up (a loss at the end) are
// counted as an open run, so ending on a loss isn't treated as ending on a win.
export function bannerEfficiency(kind, fives) {
  const q = upChance(kind, fives[0]?.time)
  if (q === null || !fives.length) return null
  const { costs, open } = upCosts(fives)
  const U = costs.length, T = costs.reduce((s, c) => s + c.cost, 0) + open
  const each = costDist(kind, q)
  // a banner that starts on a carried-over guarantee: its first rate-up costs one 5★
  const first = isOffGuaranteed(fives[0]) ? pityDist(kind) : each
  const top = open ? countPercentile(each, U, T, first) : sumPercentile(each, U, T, first)
  return { U, T, top }
}

// 50/50s (agents) or 75/25s (W-Engines) as a Poisson-binomial.
export function fiftyLuck(fives, kind = 'character') {
  const won = kind === 'character' ? 'win' : 'up', lost = kind === 'character' ? 'lose' : 'off'
  const ps = []
  let w = 0
  for (const f of fives) {
    if (f.result !== won && f.result !== lost) continue
    if (f.result === won) w++
    ps.push(upChance(kind))
  }
  const d = poissonBinomial(ps)
  const gt = d.slice(w + 1).reduce((a, b) => a + b, 0)
  return { w, n: ps.length, expected: ps.reduce((a, b) => a + b, 0), top: ps.length ? gt + d[w] / 2 : 0.5 }
}

function poissonBinomial(ps) {
  let d = [1]
  for (const p of ps) {
    const nd = new Array(d.length + 1).fill(0)
    d.forEach((v, i) => { nd[i] += v * (1 - p); nd[i + 1] += v * p })
    d = nd
  }
  return d
}

// "吃满大保底": rate-ups that cost FULL_PITY pulls or more, against the expected count.
// Fewer than expected is lucky: top = P(K < k) + P(K = k) / 2
export function fullPityLuck(kind, fives, threshold = FULL_PITY) {
  const { costs } = upCosts(fives)
  if (!costs.length || upChance(kind) === null) return null
  const ps = costs.map(c => 1 - cdfAt(costDist(kind, upChance(kind, c.f.time)), threshold - 1))
  const k = costs.filter(c => c.cost >= threshold).length
  const d = poissonBinomial(ps)
  const lt = d.slice(0, k).reduce((a, b) => a + b, 0)
  return { k, n: costs.length, expected: ps.reduce((a, b) => a + b, 0), top: lt + d[k] / 2 }
}

// Worst and best banner: ranked by pulls spent beyond what its rate-ups should have cost
// ("spent a lot, got few rate-ups"), so a small banner with one slow pull doesn't outrank a
// big one. excess = T - expected pulls for U rate-ups (a banner opening on a carried
// guarantee expects one 5★ for its first). The tier shown is the banner's own efficiency.
export function bannerExtremes(kind, fives) {
  if (upChance(kind) === null) return null
  const groups = new Map()
  for (const f of fives) {
    if (!f.bannerKey) continue
    if (!groups.has(f.bannerKey)) groups.set(f.bannerKey, [])
    groups.get(f.bannerKey).push(f)
  }
  const banners = []
  for (const items of groups.values()) {
    const e = bannerEfficiency(kind, items)
    if (!e) continue
    const cost = moments(costDist(kind, upChance(kind, items[0].time))).mean
    const single = moments(pityDist(kind)).mean
    const expected = e.U === 0 ? 0 : (isOffGuaranteed(items[0]) ? single : cost) + (e.U - 1) * cost
    banners.push({ ...e, expected, excess: e.T - expected, first: items[0] })
  }
  if (!banners.length) return null
  const worst = banners.reduce((a, b) => (b.excess > a.excess ? b : a))
  const best = banners.reduce((a, b) => (b.excess < a.excess ? b : a))
  return { n: banners.length, worst, best }
}

// Pulls per rate-up 5★: all pulls that produced a 5★, divided by the rate-up ones.
export function upAverage(pool) {
  const fives = pool?.fives || []
  const ups = fives.filter(isUp).length
  const pulls = fives.reduce((s, f) => s + f.pity, 0)
  return { ups, pulls, avg: ups ? pulls / ups : null }
}

// Expected pulls per rate-up 5★ under the models (a loss costs one extra 5★)
export function expectedUpAverage(kind) {
  if (upChance(kind) === null) return null
  const v = pityModel(kind).mean * (2 - upChance(kind))
  return { pre: v, post: v }
}

// ---- collection ------------------------------------------------------------------------

// Copies and pulls per rate-up character.
//   copies: every 5★ copy from any wish (constellation = copies - 1)
//   pulls:  for each copy that was a rate-up, the pulls since the previous rate-up on that
//           wish (a lost 5★ before the guarantee is charged to the character it led to);
//           copies that came as a loss or from the standard wish add no pulls, since those
//           pulls are already charged to a rate-up.
// isLimited(f): the 5★ is a character that has been rate-up on a character event banner at
// some point in the banner history (not just in this account's records; chronicled pick
// lists include standard characters, so they don't count).
// extras: { itemId: copies } obtained outside wishes (gifts, exchanges), entered by hand; they
// add to the constellation only. nameOf(itemId) names characters that have no wish copies.
export function buildCollection(pools, isLimited, extras = {}, nameOf = id => id) {
  const out = new Map()
  const entry = f => {
    if (!out.has(f.name)) out.set(f.name, { name: f.name, itemId: f.itemId, copies: 0, upCopies: 0, otherCopies: 0, pulls: 0, first: f.time, last: f.time })
    const e = out.get(f.name)
    if (f.time < e.first) e.first = f.time
    if (f.time > e.last) e.last = f.time
    return e
  }
  for (const p of Object.values(pools)) {
    const charged = new Map()
    if (p.kind === 'character') for (const c of upCosts(p.fives).costs) charged.set(c.f, c.cost)
    for (const f of p.fives) {
      if (!isLimited(f)) continue
      const e = entry(f)
      e.copies++
      if (charged.has(f)) { e.upCopies++; e.pulls += charged.get(f) }
      else if (p.kind === 'chronicled' && (f.result === 'up' || f.result === 'up_guaranteed')) { e.upCopies++; e.pulls += f.pity }
      else e.otherCopies++
    }
  }
  for (const [id, n] of Object.entries(extras || {})) {
    if (!(n > 0)) continue
    let e = [...out.values()].find(x => x.itemId === id)
    if (!e) {
      e = { name: nameOf(id) || id, itemId: id, copies: 0, upCopies: 0, otherCopies: 0, pulls: 0, first: null, last: null }
      out.set(`id:${id}`, e)
    }
    e.extraCopies = n
    e.copies += n
  }
  return [...out.values()].map(e => ({
    ...e, extraCopies: e.extraCopies || 0,
    cons: Math.min(6, e.copies - 1), extra: Math.max(0, e.copies - 7), avg: e.upCopies ? e.pulls / e.upCopies : null,
  }))
}
