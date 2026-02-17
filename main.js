const { app, BrowserWindow } = require('electron');
const path = require('path');

// Enable live reload for Electron in development
if (process.argv.includes('--dev')) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icons/icon.png'), // We'll add this later
    show: false // Don't show until ready
  });

  // Load the app's HTML file
  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event listeners
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    console.warn('Blocked new window creation:', navigationUrl);
  });
});