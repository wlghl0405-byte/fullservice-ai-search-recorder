'use strict';

const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const { fork, exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const net = require('net');

const Store = require('electron-store');

const store = new Store({
  schema: {
    anthropicApiKey: { type: 'string', default: '' },
    playwrightHeadless: { type: 'boolean', default: true },
  },
});

const IS_DEV = !app.isPackaged;

let mainWindow = null;
let splashWindow = null;
let configWindow = null;
let nextServerProcess = null;
let serverPort = 3000;

// ── 포트 탐색 ─────────────────────────────────────────────────────────────────
function findAvailablePort(start, end) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      if (port > end) return reject(new Error('No available port found'));
      const server = net.createServer();
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(port));
      });
      server.on('error', () => tryPort(port + 1));
    }
    tryPort(start);
  });
}

// ── Playwright Chromium 경로 ──────────────────────────────────────────────────
function getPlaywrightBrowsersPath() {
  return path.join(app.getPath('userData'), 'browsers');
}

function isChromiumInstalled() {
  const browsersPath = getPlaywrightBrowsersPath();
  if (!fs.existsSync(browsersPath)) return false;
  const entries = fs.readdirSync(browsersPath);
  return entries.some((e) => e.startsWith('chromium'));
}

function getPlaywrightCliPath() {
  if (IS_DEV) {
    return path.join(__dirname, '../node_modules/playwright/cli.js');
  }
  return path.join(process.resourcesPath, 'app', '.next', 'standalone', 'node_modules', 'playwright', 'cli.js');
}

function downloadChromium(onProgress) {
  return new Promise((resolve, reject) => {
    const cliPath = getPlaywrightCliPath();
    const env = {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: getPlaywrightBrowsersPath(),
    };
    const proc = exec(`node "${cliPath}" install chromium`, { env }, (err) => {
      if (err) reject(err);
      else resolve();
    });
    proc.stdout?.on('data', (d) => onProgress?.(d.toString()));
    proc.stderr?.on('data', (d) => onProgress?.(d.toString()));
  });
}

// ── Next.js 서버 시작 ─────────────────────────────────────────────────────────
function getNextServerScript() {
  if (IS_DEV) {
    return path.join(__dirname, '../.next/standalone/server.js');
  }
  return path.join(process.resourcesPath, 'app', '.next', 'standalone', 'server.js');
}

function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    function check() {
      if (Date.now() > deadline) return reject(new Error('Server startup timeout'));
      http
        .get(`http://127.0.0.1:${port}/api/exams`, (res) => {
          if (res.statusCode < 500) resolve();
          else setTimeout(check, 500);
        })
        .on('error', () => setTimeout(check, 500));
    }
    setTimeout(check, 1000);
  });
}

async function startNextServer(port) {
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'appdata');
  fs.mkdirSync(path.join(dataDir, 'saved'), { recursive: true });

  const serverScript = getNextServerScript();
  const serverDir = path.dirname(serverScript);

  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
    ANTHROPIC_API_KEY: store.get('anthropicApiKey', ''),
    DATA_DIR: dataDir,
    PLAYWRIGHT_BROWSERS_PATH: getPlaywrightBrowsersPath(),
    PLAYWRIGHT_HEADLESS: String(store.get('playwrightHeadless', true)),
    SEARCH_DELAY_MS: '3000',
    AI_ANSWER_TIMEOUT_MS: '20000',
    MAX_RETRY_COUNT: '1',
  };

  nextServerProcess = fork(serverScript, [], {
    env,
    cwd: serverDir,
    silent: true,
  });

  nextServerProcess.on('error', (err) => {
    console.error('Next.js server error:', err);
  });

  await waitForServer(port);
}

function stopNextServer() {
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
}

// ── 스플래시 창 ───────────────────────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    resizable: false,
    center: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function updateSplash(message) {
  splashWindow?.webContents?.send('status', message);
}

// ── 메인 창 ───────────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: '풀서비스 검수 자동화',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  mainWindow.once('ready-to-show', () => {
    splashWindow?.close();
    splashWindow = null;
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  buildMenu();
}

// ── 설정 창 ───────────────────────────────────────────────────────────────────
function openConfigWindow() {
  if (configWindow) {
    configWindow.focus();
    return;
  }
  configWindow = new BrowserWindow({
    width: 520,
    height: 420,
    resizable: false,
    title: '설정',
    parent: mainWindow,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  configWindow.loadFile(path.join(__dirname, 'config-window.html'));
  configWindow.on('closed', () => {
    configWindow = null;
  });
}

// ── 앱 메뉴 ───────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: '앱',
      submenu: [
        { label: `버전 ${app.getVersion()}`, enabled: false },
        { type: 'separator' },
        { role: 'quit', label: '종료' },
      ],
    },
    {
      label: '설정',
      submenu: [
        { label: 'API 키 및 환경 설정', click: openConfigWindow },
        {
          label: '데이터 폴더 열기',
          click: () => shell.openPath(path.join(app.getPath('userData'), 'appdata', 'saved')),
        },
      ],
    },
    {
      label: '보기',
      submenu: [
        { role: 'reload', label: '새로고침' },
        { role: 'toggleDevTools', label: '개발자 도구' },
        { type: 'separator' },
        { role: 'resetZoom', label: '기본 크기' },
        { role: 'zoomIn', label: '확대' },
        { role: 'zoomOut', label: '축소' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체화면' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC 핸들러 ────────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('get-config', () => ({
  anthropicApiKey: store.get('anthropicApiKey', ''),
  playwrightHeadless: store.get('playwrightHeadless', true),
}));

ipcMain.handle('save-config', async (_, config) => {
  store.set('anthropicApiKey', config.anthropicApiKey || '');
  store.set('playwrightHeadless', config.playwrightHeadless !== false);
  // 새 API 키를 적용하려면 서버 재시작 필요
  stopNextServer();
  await startNextServer(serverPort);
  return { success: true };
});

ipcMain.handle('check-chromium', () => isChromiumInstalled());

ipcMain.handle('install-chromium', async (event) => {
  try {
    await downloadChromium((msg) => {
      event.sender.send('chromium-progress', msg);
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ── 앱 시작 ───────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (IS_DEV) {
    // 개발 모드: next dev 서버가 이미 실행 중 (wait-on으로 보장)
    serverPort = 3000;
    createMainWindow();
    return;
  }

  createSplashWindow();

  try {
    // 1. Chromium 확인
    if (!isChromiumInstalled()) {
      updateSplash('Playwright Chromium 다운로드 중...\n(최초 1회, 약 200MB)');
      await downloadChromium((msg) => updateSplash(`Chromium 설치 중...\n${msg.trim().slice(0, 80)}`));
    }

    // 2. 포트 탐색
    updateSplash('서버 포트 확인 중...');
    serverPort = await findAvailablePort(3000, 3099);

    // 3. Next.js 서버 시작
    updateSplash(`서버 시작 중... (포트 ${serverPort})`);
    await startNextServer(serverPort);

    // 4. 메인 창 열기
    createMainWindow();
  } catch (err) {
    console.error('Startup failed:', err);
    const { dialog } = require('electron');
    dialog.showErrorBox('시작 오류', String(err));
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopNextServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('before-quit', () => {
  stopNextServer();
});
