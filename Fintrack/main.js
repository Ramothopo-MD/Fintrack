const { app, BrowserWindow } = require("electron");
const { exec } = require("child_process");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, "public/images/icon.ico"),
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const server = exec("node app.js");

  setTimeout(() => {
    win.loadURL("http://localhost:2020"); // change port if needed
  }, 3000);

  win.on("closed", () => {
    server.kill();
  });
}

app.whenReady().then(createWindow);
