// Messaging + notifications helper for MV3

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon128.png",
    title,
    message,
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;
  if (message.type === "NOTIFY") {
    notify(message.title || "CapThat!", message.message || "");
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "ADD_TO_BOARD") {
    (async () => {
      try {
        const { payload } = message;
        const { board = [] } = await chrome.storage.local.get("board");
        if (board.length >= 10) {
          notify("CapThat!", "Board is full");
          return sendResponse({ ok: false, error: "Board full" });
        }
        if (board.some((i) => i.src === payload.src)) {
          notify("CapThat!", "Already captured");
          return sendResponse({ ok: false, error: "Duplicate" });
        }
        const next = [...board, { ...payload, ts: Date.now() }];
        await chrome.storage.local.set({ board: next });
        notify("CapThat!", "Captured image");
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  return false;
});
