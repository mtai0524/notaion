// Notaion Daily Notes — popup actions.
// Opens the deployed Daily Note page; reuses an existing Notaion tab if one
// is already open, otherwise creates a new one.

const APP_URL = "https://notaion.onrender.com";
const DAILY_URL = `${APP_URL}/daily-note`;

// Focus an already-open Notaion tab (any page) or open a fresh Daily Note tab.
async function openNotaion(forceNewTab) {
  if (!forceNewTab) {
    const existing = await chrome.tabs.query({ url: `${APP_URL}/*` });
    if (existing.length > 0) {
      const tab = existing[0];
      await chrome.tabs.update(tab.id, { active: true, url: DAILY_URL });
      await chrome.windows.update(tab.windowId, { focused: true });
      window.close();
      return;
    }
  }
  await chrome.tabs.create({ url: DAILY_URL });
  window.close();
}

document.getElementById("open-today").addEventListener("click", () => openNotaion(false));
document.getElementById("open-tab").addEventListener("click", () => openNotaion(true));
