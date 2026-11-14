// Agent / W-Engine icons, fetched on demand and cached next to the app in userData/icons.
// The id -> image path maps come from EnkaNetwork/API-docs (store/zzz/avatars.json and
// weapons.json, no licence, so not bundled) and the images from enka.network. They are
// HoYoverse game assets either way. Bangboo have no source yet.
const { ipcMain } = require('electron')
const fetch = require('electron-fetch').default
const path = require('path')
const fs = require('fs-extra')
const { userDataPath } = require('./utils')

const cacheDir = path.join(userDataPath, 'icons')
const MAP_SOURCES = [
  'https://cdn.jsdelivr.net/gh/EnkaNetwork/API-docs@master/store/zzz',
  'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz',
]
const IMAGE_BASE = 'https://enka.network'
const MAP_MAX_AGE = 7 * 24 * 3600e3
const SAFE_ID = /^\d{4,6}$/
const failed = new Set()   // don't hammer the network for ids that fail this session

// Image type from the file signature; the extension can't be trusted.
function sniff(buf) {
  if (!buf || buf.length < 12) return null
  if (buf.readUInt32BE(0) === 0x89504e47) return 'image/png'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  return null
}

async function fetchJson(name) {
  for (const base of MAP_SOURCES) {
    try {
      const res = await fetch(`${base}/${name}`, { timeout: 20000 })
      if (res.ok) return await res.json()
    } catch (e) { /* try next source */ }
  }
  return null
}

// item_id -> image path, from the cached Enka maps (refreshed weekly)
let pathMap = null
async function getPathMap() {
  if (pathMap) return pathMap
  const file = path.join(cacheDir, 'enka-zzz-map.json')
  let cached = null
  try { cached = await fs.readJSON(file) } catch (e) { /* none yet */ }
  if (!cached || Date.now() - cached.fetchedAt > MAP_MAX_AGE) {
    const [avatars, weapons] = await Promise.all([fetchJson('avatars.json'), fetchJson('weapons.json')])
    if (avatars && weapons) {
      const map = {}
      for (const [id, a] of Object.entries(avatars)) if (a.CircleIcon || a.Image) map[id] = a.CircleIcon || a.Image
      for (const [id, w] of Object.entries(weapons)) if (w.ImagePath) map[id] = w.ImagePath
      cached = { fetchedAt: Date.now(), map }
      await fs.outputJSON(file, cached)
    }
  }
  pathMap = cached?.map || {}
  return pathMap
}

async function getIcon(id, offline) {
  if (!SAFE_ID.test(id)) return null
  const file = path.join(cacheDir, `${id}.img`)
  try {
    return await fs.readFile(file)
  } catch (e) { /* not cached */ }
  if (offline || failed.has(id)) return null
  const rel = (await getPathMap())[id]
  if (!rel || !/^\/ui\/zzz\/[\w.-]+$/.test(rel)) { failed.add(id); return null }
  try {
    const res = await fetch(`${IMAGE_BASE}${rel}`, { timeout: 15000 })
    const buf = res.ok ? await res.buffer() : null
    if (!sniff(buf)) { failed.add(id); return null }
    await fs.outputFile(file, buf)
    return buf
  } catch (e) {
    failed.add(id)
    return null
  }
}

// items: [{ id }] (item_id from the records) -> { id: dataURL }
// offline: only return what is already cached (instant), so the UI can show those first
ipcMain.handle('GET_ICONS', async (event, items, { offline = false } = {}) => {
  const out = {}
  const queue = [...new Map((items || []).map(i => [i.id, i])).values()]
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const buf = await getIcon(item.id, offline)
      const mime = sniff(buf)
      if (mime) out[item.id] = `data:${mime};base64,${buf.toString('base64')}`
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return out
})
