// Generate src/data/banners.json from quantulr/hoyo-gacha's assets/zzz-banners.json (MIT),
// with rate-up names mapped to item ids through src/idJson.json.
// usage: node scripts/gen-banners.mjs [--ref main]
//
// Output: { source, generatedAt, banners: [{ id, version, phase, channel, rerun, gachaType,
//           title, up5: [item_id], names: { item_id: zh name }, start, startLocal, end, endLocal }] }
//
// Times are UTC+8 as published. Signal records carry no banner id (gacha_id is always "0"),
// so the judge matches by time, and which boundaries are server-local was worked out
// against real records:
//   second-half start (12:00), first-half end (11:59:59) and version end (14:59:59) are
//   server-local; version launches (10:00/11:00) are global, in UTC+8.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ref = process.argv.includes('--ref') ? process.argv[process.argv.indexOf('--ref') + 1] : 'main'
const URL_ = `https://raw.githubusercontent.com/quantulr/hoyo-gacha/${ref}/assets/zzz-banners.json`
const LOCAL = ['12:00:00', '11:59:59', '14:59:59']

const res = await fetch(URL_)
if (!res.ok) throw new Error(`${res.status} ${URL_}`)
const raw = await res.json()
if (raw.timezone !== 'UTC+8' || !Array.isArray(raw.banners)) throw new Error('unexpected banner data format')

const idJson = JSON.parse(await fs.readFile(path.join(root, 'src/idJson.json'), 'utf8'))
const nameToId = new Map(Object.entries(idJson['zh-cn']).map(([id, v]) => [v.name, id]))

const problems = []
const banners = raw.banners.map((b, i) => {
  if (!['character', 'engine'].includes(b.channel)) problems.push(`unknown channel ${b.channel} in ${b.title}`)
  // several selectable rate-ups = 独家重映 / 音擎回响 (gacha types 102 / 103)
  const rerun = b.up.length > 1
  const up5 = b.up.map(n => {
    const id = nameToId.get(n)
    if (!id) problems.push(`${b.version} ${b.phase} ${b.title}: no item id for "${n}" (update src/idJson.json)`)
    return id
  }).filter(Boolean)
  return {
    id: i, version: b.version, phase: b.phase, channel: b.channel, rerun,
    gachaType: b.channel === 'character' ? (rerun ? '102' : '2') : (rerun ? '103' : '3'),
    title: b.title, up5, names: Object.fromEntries(up5.map((id, k) => [id, b.up[k]])),
    start: b.start, startLocal: LOCAL.includes(b.start.slice(11)),
    end: b.end, endLocal: LOCAL.includes(b.end.slice(11)),
  }
})

const out = {
  source: `https://github.com/quantulr/hoyo-gacha (assets/zzz-banners.json, ${ref}, MIT); data from ${raw.source}`,
  upstreamUpdated: raw.updated,
  generatedAt: new Date().toISOString(),
  banners,
}
const file = path.join(root, 'src/data/banners.json')
await fs.mkdir(path.dirname(file), { recursive: true })
await fs.writeFile(file, JSON.stringify(out, null, 1) + '\n')
const last = banners.at(-1)
console.log(`${banners.length} banners (${banners.filter(b => b.rerun).length} reruns), latest ${last.version} ${last.phase} ${last.start}; wrote ${path.relative(root, file)}`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  problems.forEach(p => console.error('  ' + p))
  process.exitCode = 1
}
