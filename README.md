## CapThat! — Chrome Extension for Rapid Image Mood‑Boards

CapThat! is a minimalist Chrome MV3 extension that lets you capture images en masse while browsing and assemble them into an exportable mood‑board.

### Demo

<video src="./public/demo.mp4" controls preload="metadata" style="max-width:100%; height:auto; border:1px solid #e5e7eb; border-radius:8px;"></video>

If it still doesn't render inline on your host:

- Open the raw file URL (e.g., on GitHub: click the file → "Raw") and use that absolute URL in the `src`.
- Ensure the video is encoded with H.264/AAC (MP4 container) for broad browser support.

### Features

- Capture the currently hovered image with a single click
- On‑image floating “Cap!” button overlay (bottom‑right of the hovered image)
- CapBoard grid in the popup (up to 10 images)
- Shows the source hostname under each tile
- Confirm before clearing the board
- Export the CapBoard as a JPEG (composited via canvas)
- Dedupe by image URL; skip duplicates
- Lightweight in‑page toast feedback on capture (Captured / Duplicate / Board full)
- Uses `chrome.storage.local` for persistence
- Works with Active Tab only (no broad host permissions)

### How it works

- A content script listens for mouseover events and tracks the hovered `<img>` element. It renders a high z‑index, circular “Cap!” overlay near the image’s bottom‑right corner. Clicking it sends an `ADD_TO_BOARD` message with `{ src, pageUrl }` to the background service worker.
- The background service worker (MV3) receives `ADD_TO_BOARD`, reads the saved board from `chrome.storage.local`, enforces a 10‑item limit and de‑duplicates by `src`, updates storage, and (optionally) fires a native notification.
- The popup reads the board and displays a 4×N grid. It listens to `chrome.storage.onChanged` to live‑update. Export uses an offscreen canvas to composite the grid and downloads a JPEG.

### Local development and testing

1. Build is not required; the extension is plain HTML/CSS/JS located under `extension/`.
2. Open Chrome → `chrome://extensions` → enable Developer Mode.
3. Click “Load unpacked” and select the `extension/` folder in this repo.
4. Pin the extension. While browsing a page with images:
   - Hover an image to see the “Cap!” overlay. Click it to add the image to the board.
   - Open the extension popup to view the grid, export JPEG, or clear the board.

### Notes and limitations

- Canvas export may skip images that are cross‑origin without permissive CORS headers (canvas becomes tainted).
- The overlay appears for `<img>` elements; background images and videos are not captured in this MVP.
- Popup size is CSS‑resizable; we can add a drag handle if needed.

### Repository layout

- `extension/manifest.json` — MV3 manifest (permissions: `activeTab`, `storage`, `notifications`, `scripting`)
- `extension/content.js` — hover tracking, overlay button, in‑page toast
- `extension/service-worker.js` — background logic, storage, notifications
- `extension/popup.html` / `popup.css` / `popup.js` — CapBoard UI, export, clear
- `public/demo.webm` — optional demo video (add this file yourself)

### Roadmap (next)

- Drag‑to‑reorder tiles; remove from board
- Optional capture of CSS background images
- Keyboard shortcut for capture
- Theming and exact styling to match the mock
