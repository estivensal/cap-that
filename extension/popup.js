const MAX_ITEMS = 10;
const MAX_IMAGE_DIM = 1024; // downscale bound for export

const gridEl = document.getElementById("grid");
const capBtn = document.getElementById("capBtn");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const countLabel = document.getElementById("countLabel");

function toast(text) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = text;
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => t.classList.remove("show"), 1500);
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadBoard() {
  const { board = [] } = await chrome.storage.local.get("board");
  return board;
}

async function saveBoard(board) {
  await chrome.storage.local.set({ board });
}

function renderBoard(board) {
  gridEl.innerHTML = "";
  board.forEach((item) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    const img = document.createElement("img");
    img.src = item.src; // thumbnails use original src; rendering is lightweight
    cell.appendChild(img);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.title = item.pageUrl;
    meta.textContent = new URL(item.pageUrl).hostname;
    cell.appendChild(meta);
    gridEl.appendChild(cell);
  });
  countLabel.textContent = `${board.length} / ${MAX_ITEMS}`;
  capBtn.disabled = board.length >= MAX_ITEMS;
}

async function capHoveredImage() {
  const tab = await getCurrentTab();
  return await chrome.tabs.sendMessage(tab.id, { type: "CAP_HOVERED_IMAGE" });
}

async function addCurrentHoverToBoard() {
  let board = await loadBoard();
  if (board.length >= MAX_ITEMS) {
    toast("Board is full");
    return;
  }
  const res = await capHoveredImage();
  if (!res || !res.ok) {
    toast("No hovered image");
    return;
  }
  const { src, pageUrl } = res.payload;
  // simple de-dupe by src
  if (board.some((i) => i.src === src)) {
    toast("Already captured");
    return;
  }
  board.push({ src, pageUrl, ts: Date.now() });
  await saveBoard(board);
  renderBoard(board);
  chrome.runtime.sendMessage({
    type: "NOTIFY",
    title: "CapThat!",
    message: "Captured image",
  });
}

async function clearBoardWithConfirm() {
  if (!confirm("Clear Cap Board?")) return;
  await saveBoard([]);
  renderBoard([]);
}

async function exportJPEG() {
  const board = await loadBoard();
  if (board.length === 0) {
    toast("Nothing to export");
    return;
  }
  // Layout: 4 columns, up to 3 rows (max 10 imgs)
  const cols = 4;
  const cell = 256; // canvas cell size for export
  const gap = 8;
  const rows = Math.ceil(board.length / cols);
  const width = cols * cell + (cols - 1) * gap;
  const height = rows * cell + (rows - 1) * gap;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < board.length; i++) {
    const item = board[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (cell + gap);
    const y = row * (cell + gap);
    try {
      const img = await loadImageWithBounds(item.src);
      const { drawW, drawH } = fitContain(
        img.naturalWidth,
        img.naturalHeight,
        cell,
        cell
      );
      const dx = x + (cell - drawW) / 2;
      const dy = y + (cell - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
    } catch (e) {
      // skip failed image
    }
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `capboard-${Date.now()}.jpg`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Exported JPEG");
}

function fitContain(sw, sh, dw, dh) {
  const scale = Math.min(dw / sw, dh / sh);
  return { drawW: Math.round(sw * scale), drawH: Math.round(sh * scale) };
}

function loadImageWithBounds(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // best effort; may still taint for some hosts
    img.onload = () => {
      // downscale if too large to save memory
      if (Math.max(img.naturalWidth, img.naturalHeight) > MAX_IMAGE_DIM) {
        const scale =
          MAX_IMAGE_DIM / Math.max(img.naturalWidth, img.naturalHeight);
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        const cx = c.getContext("2d");
        cx.drawImage(img, 0, 0, c.width, c.height);
        const downsized = new Image();
        downsized.onload = () => resolve(downsized);
        downsized.onerror = reject;
        downsized.src = c.toDataURL("image/jpeg", 0.9);
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

async function init() {
  const board = await loadBoard();
  renderBoard(board);
  capBtn.addEventListener("click", addCurrentHoverToBoard);
  clearBtn.addEventListener("click", clearBoardWithConfirm);
  exportBtn.addEventListener("click", exportJPEG);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.board) {
      renderBoard(changes.board.newValue || []);
    }
  });
}

init();
