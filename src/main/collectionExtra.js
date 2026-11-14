// Character copies obtained outside wishes (gifts, exchanges), entered by hand in the
// collection view. Kept in userData/collection-extra.json, per uid: { uid: { itemId: n } }.
const { ipcMain } = require('electron')
const path = require('path')
const fs = require('fs-extra')
const { userDataPath } = require('./utils')

const file = path.join(userDataPath, 'collection-extra.json')
const read = async () => { try { return await fs.readJSON(file) } catch (e) { return {} } }

ipcMain.handle('GET_COLLECTION_EXTRA', async (event, uid) => (await read())[String(uid)] || {})

ipcMain.handle('SET_COLLECTION_EXTRA', async (event, uid, itemId, count) => {
  const all = await read()
  const mine = all[String(uid)] || {}
  const n = Math.max(0, Math.min(99, Math.floor(Number(count) || 0)))
  if (n) mine[String(itemId)] = n
  else delete mine[String(itemId)]
  all[String(uid)] = mine
  await fs.outputJSON(file, all, { spaces: 2 })
  return mine
})
