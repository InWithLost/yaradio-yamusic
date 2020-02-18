import * as path from 'path';
import * as fs from 'mz/fs';
import { app, BrowserWindow, session } from 'electron';
import store from './modules/store';
import ctxMenu from './modules/menu';
import globalShortcut from './modules/globalShortcut';
import notifiNextSing from './modules/notifiNextSong';

// For development
if (process.env.node_env == 'dev') {
  require('electron-debug')({
    enabled: true,
    showDevTools: 'undocked'
  });
}

const _defaultHeight = 700;
const _defaultWidth = 848;

let win: BrowserWindow | null = null;
let appRunning = app.requestSingleInstanceLock();

if (!appRunning) {
  app.quit();
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized() || !win.isVisible()) {
      win.restore();
    }
    win.focus();
  }
})

function createWindow() {
  const lastWindowState = store.get('lastWindowState');
  const lastApp = store.get('lastApp');

  const win = new BrowserWindow({
    title: 'YaRadio',
    show: false,
    x: lastWindowState ? lastWindowState.x : 0,
    y: lastWindowState ? lastWindowState.y : 0,
    height: lastWindowState ? lastWindowState.height : _defaultHeight,
    width: lastWindowState ? lastWindowState.width : _defaultWidth,
    icon: path.join(__dirname, 'media/icon', 'yaradio.png'),
    titleBarStyle: 'hiddenInset',
    minHeight: _defaultHeight,
    minWidth: _defaultWidth,
    autoHideMenuBar: true,
    backgroundColor: '#fff', // check this
    webPreferences: {
      preload: path.join(__dirname, './modules/browser/js', 'browser.js'),
      nodeIntegration: false,
      plugins: true
    }
  });

  win.loadURL((() => {
    if (lastApp == 'YaMusic') {
      return 'https://music.yandex.ru/'
    }
    return 'https://radio.yandex.ru/'
  })());

  win.on('close', e => {

    if (!store.get('quit?')) {
      e.preventDefault();
    }

    switch (process.platform) {
      case 'win32':
        win.hide();
        break;
      case 'linux':
        win.hide();
        break;
      case 'darwin':
        app.hide();
        break;
      default:
    }
  });

  win.on('page-title-updated', (e: any) => {
    let history = e.sender.webContents.history;

    if (/radio/.test(history[history.length - 1])) {
      win.setTitle('YaRadio');

      if (process.platform !== 'darwin') {
        win.setIcon(path.join(__dirname, '../media/icon', 'yaradio_32x32.png'));
      }
    } else {
      win.setTitle('YaMusic');

      if (process.platform !== 'darwin') {
        win.setIcon(path.join(__dirname, '../media/icon', 'yamusic_32x32.png'));
      }
    }

    e.preventDefault();
  });

  return win
}

app.on("ready", () => {
  win = createWindow();

  ctxMenu(win, app);
  globalShortcut(win, app);
  win.setMenu(null);

  let page = win.webContents;

  page.on('dom-ready', () => {
    const cssFile = fs.readFileSync(path.join(__dirname, '/modules/browser/css', 'css.css'), 'utf8');

    page.insertCSS(cssFile);

    if (win) {
      win.show();
    }
  })

  let sendNotifi = notifiNextSing(win);

  session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    // Skip advertising
    if (/awaps.yandex.net/.test(details.url) || /vh-bsvideo-converted/.test(details.url) || /get-video-an/.test(details.url)) {
      return {
        cancel: true
      }
    }
    // Notification for next sing
    if (/start\?__t/.test(details.url)) {
      setTimeout(sendNotifi, 1000)
    }

    callback({});
  })
})

app.on('before-quit', () => {
  store.set('quit?', true);

  if (win) {
    if (!win.isFullScreen()) {
      store.set('lastWindowState', win.getBounds());
    }

    store.set('lastApp', win.getTitle());
  }
});
