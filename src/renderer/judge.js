// Classify every S-rank against the banners running when it was pulled.
//
// Signal records have item_id but no banner id (gacha_id is always "0"), so banners are
// matched by time. Two agent (or W-Engine) banners usually run at once under the same
// gacha_type and can't be told apart, so an S-rank is a "win" when it is a rate-up of any
// banner running then. No standard-character list is consulted.
//
// judge(result, bannerData, { tz }) -> { pools, issues }
//   result: Map or [[gachaType, records]] as stored by getData.js; a record is
//           { id, item_id, item_type, name, rank_type, time, gacha_id, gacha_type }
//   bannerData: src/data/banners.json
//   tz: the account's server UTC offset in hours (records' region_time_zone)

// pity is tracked per gacha_type; reruns (102/103) have their own counters
export const POOL_KIND = { '2': 'character', '102': 'character', '3': 'engine', '103': 'engine', '5': 'bangboo', '1': 'standard' }
const S_RANK = '4'

const toMs = t => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10), +t.slice(11, 13), +t.slice(14, 16), +t.slice(17, 19))
const byId = (a, b) => {
  if (a.id && b.id) return BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0
  return a.time < b.time ? -1 : a.time > b.time ? 1 : 0
}

// Banner windows in the account's server time, per gacha_type.
// A version launch is global (UTC+8) and goes live a little earlier on some servers than the
// published time, while the previous version has already ended (server-local): the gap
// between them can only belong to the new banners, so launches are extended back to it.
export function prepareBanners(bannerData, tz = 8) {
  const shift = (tz - 8) * 3600e3
  const byType = {}
  for (const b of bannerData.banners) {
    const s = toMs(b.start) + (b.startLocal ? 0 : shift)
    const e = toMs(b.end) + (b.endLocal ? 0 : shift)
    ;(byType[b.gachaType] ||= []).push({ ...b, s, e })
  }
  for (const list of Object.values(byType)) {
    const ends = list.map(b => b.e).sort((a, b) => a - b)
    for (const b of list) {
      if (b.startLocal) continue
      const prev = ends.filter(e => e < b.s).pop()
      if (prev !== undefined) b.s = Math.min(b.s, prev + 1000)
    }
  }
  return byType
}

// A loss and the guaranteed S-rank it paid for point at each other (they may sit in different periods)
const ref = f => ({ id: f.id, name: f.name, time: f.time, key: f.bannerKey, up: f.up })
function link(loss, guaranteed) {
  if (!loss || !guaranteed) return
  loss.guaranteeTo = ref(guaranteed)
  guaranteed.guaranteeFrom = ref(loss)
}

export function judge(result, bannerData, { tz = 8 } = {}) {
  const banners = prepareBanners(bannerData, tz)
  const entries = result instanceof Map ? [...result] : result

  // localized names from the records themselves, so rate-up names follow the game language
  const nameOf = new Map()
  for (const [, recs] of entries) for (const r of recs) nameOf.set(String(r.item_id), r.name)

  const pools = {}
  const issues = []
  for (const [key, records] of entries) {
    const kind = POOL_KIND[key]
    if (!kind) continue
    const recs = [...records].sort(byId)
    const fives = []
    const welfareUsed = new Set()   // reruns: the first S-rank of each period is the chosen rate-up
    let pity = 0, guaranteed = false, streak = 0, pendingLoss = null
    for (const r of recs) {
      pity++
      if (String(r.rank_type) !== S_RANK) continue
      const f = {
        id: r.id, time: r.time, name: r.name, itemId: String(r.item_id), pity,
        gachaType: String(r.gacha_type), result: 'unknown',
      }
      pity = 0
      fives.push(f)
      if (kind === 'standard' || kind === 'bangboo') { f.result = 'standard'; continue }
      const t = toMs(r.time)
      const hit = (banners[key] || []).filter(b => b.s <= t && t <= b.e)
      if (!hit.length) {
        f.note = 'no banner running at this time'
        issues.push({ pool: key, ...f })
        continue
      }
      const ups = [...new Set(hit.flatMap(b => b.up5))]
      const phases = [...new Set(hit.map(b => b.phase))]
      f.banner = { version: hit[0].version, phase: phases.join('/'), label: `${hit[0].version} ${phases.join('/')}`, name: hit.map(b => b.title).join(' / ') }
      f.bannerKey = hit.map(b => b.id).sort((a, b) => a - b).join('+')   // the S-rank history groups by this
      f.up = ups.map(id => nameOf.get(id) || hit.find(b => b.names[id])?.names[id] || id)
      const inUp = ups.includes(f.itemId)

      if (hit[0].rerun && !welfareUsed.has(f.bannerKey)) {
        // 福利保底: the first S-rank of a rerun period is the chosen rate-up, outside the normal rules
        welfareUsed.add(f.bannerKey)
        if (inUp) { f.result = 'guaranteed'; f.note = 'welfare'; continue }
      }
      if (kind === 'character') {
        if (guaranteed) {
          f.result = 'guaranteed'
          if (!inUp) { f.note = 'lost a guaranteed pull'; issues.push({ pool: key, ...f }) }
          guaranteed = false
          link(pendingLoss, f); pendingLoss = null
        } else {
          f.streakBefore = streak
          if (inUp) { f.result = 'win'; streak = 0 } else { f.result = 'lose'; guaranteed = true; streak++; pendingLoss = f }
        }
      } else {
        // W-Engines: 75% rate-up, then guaranteed
        f.result = inUp ? (guaranteed ? 'up_guaranteed' : 'up') : 'off'
        if (guaranteed && !inUp) { f.note = 'off-banner right after off-banner'; issues.push({ pool: key, ...f }) }
        if (guaranteed) { link(pendingLoss, f); pendingLoss = null }
        if (!inUp) pendingLoss = f
        guaranteed = !inUp
      }
    }
    pools[key] = { kind, total: recs.length, pity, guaranteed: kind === 'character' || kind === 'engine' ? guaranteed : false, streak, fives }
  }
  return { pools, issues }
}

// Win rate over 50/50s only, with a 95% Wilson interval
export function winRate(fives) {
  const w = fives.filter(f => f.result === 'win').length
  const n = w + fives.filter(f => f.result === 'lose').length
  if (!n) return { w, n, rate: null, lo: null, hi: null }
  const z = 1.96, p = w / n, den = 1 + z * z / n
  const c = (p + z * z / (2 * n)) / den, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
  return { w, n, rate: p, lo: c - h, hi: c + h }
}
