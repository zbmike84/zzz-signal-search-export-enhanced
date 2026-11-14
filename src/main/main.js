const { app, BrowserWindow, ipcMain } = require('electron')

// Chromium's sandboxed child processes can't start from a network location
// (\\server\share or a mapped drive), so the app fails when kept on a NAS unless it
// is launched with --no-sandbox. The sandbox adds little here: windows already run
// with nodeIntegration and only load the bundled pages. (Windows only: on Linux the
// zygote starts before this runs.)
app.commandLine.appendSwitch('no-sandbox')
const { initWindow } = require('./utils')
const { disableProxy, proxyStatus } = require('./module/system-proxy')
require('./getData')
require('./bridge')
require('./excel')
require('./UIGFJson')
require('./icons')
require('./collectionExtra')
const { getUpdateInfo } = require('./update/index')

const isDev = !app.isPackaged
let win = null

function createWindow() {
  win = initWindow()
  win.setMenuBarVisibility(false)
  isDev ? win.loadURL(`http://localhost:${process.env.PORT}`) : win.loadFile('dist/electron/renderer/index.html')
  if (isDev) {
    win.webContents.openDevTools({ mode: 'undocked', activate: true })
  }
}

const isFirstInstance = app.requestSingleInstanceLock()

if (!isFirstInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(createWindow)

  ipcMain.handle('RELAUNCH', async () => {
    app.relaunch()
    app.exit(0)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  app.on('will-quit', (e) => {
    if (proxyStatus.started) {
      disableProxy()
    }
    if (getUpdateInfo().status === 'moving') {
      e.preventDefault()
      setTimeout(() => {
        app.quit()
      }, 3000)
    }
  })

  app.on('quit', () => {
    if (proxyStatus.started) {
      disableProxy()
    }
  })
}