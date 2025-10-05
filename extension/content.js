// Tracks the currently hovered image element on the page
let currentHoveredImg = null;
let overlayButton = null;
let inlineToast = null;

function isElementVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function handleMouseOver(e) {
  const target = e.target;
  // Ignore events originating from our overlay button to prevent flicker
  if (
    overlayButton &&
    (target === overlayButton || overlayButton.contains(target))
  ) {
    return;
  }
  if (target && target.tagName === "IMG") {
    currentHoveredImg = target;
    ensureOverlay(target);
  } else {
    currentHoveredImg = null;
    hideOverlay();
  }
}

document.addEventListener("mouseover", handleMouseOver, {
  capture: true,
  passive: true,
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "CAP_HOVERED_IMAGE") {
    (async () => {
      try {
        if (!currentHoveredImg || !isElementVisible(currentHoveredImg)) {
          return sendResponse({ ok: false, error: "No hovered image." });
        }
        const src = currentHoveredImg.currentSrc || currentHoveredImg.src;
        const pageUrl = location.href;
        sendResponse({ ok: true, payload: { src, pageUrl } });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true; // async response
  }
  return false;
});

function ensureOverlay(imgEl) {
  if (!overlayButton) {
    overlayButton = document.createElement("button");
    overlayButton.textContent = "Cap!";
    overlayButton.style.position = "fixed";
    overlayButton.style.zIndex = "2147483647";
    overlayButton.style.padding = "6px 10px";
    overlayButton.style.borderRadius = "9999px";
    overlayButton.style.border = "1px solid #0f172a";
    overlayButton.style.background = "#45d1c4";
    overlayButton.style.color = "#073b3a";
    overlayButton.style.fontWeight = "700";
    overlayButton.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
    overlayButton.style.cursor = "pointer";
    overlayButton.style.userSelect = "none";
    overlayButton.addEventListener("click", onOverlayClick, { capture: true });
    document.documentElement.appendChild(overlayButton);
  }
  positionOverlay(imgEl);
  overlayButton.style.display = "block";
}

function hideOverlay() {
  if (overlayButton) overlayButton.style.display = "none";
}

function positionOverlay(imgEl) {
  const rect = imgEl.getBoundingClientRect();
  const x = rect.right - 30; // bottom-right like mock
  const y = rect.bottom - 30;
  overlayButton.style.left = `${Math.round(x)}px`;
  overlayButton.style.top = `${Math.round(y)}px`;
}

async function onOverlayClick(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  if (!currentHoveredImg || !isElementVisible(currentHoveredImg)) return;
  const src = currentHoveredImg.currentSrc || currentHoveredImg.src;
  const pageUrl = location.href;
  chrome.runtime.sendMessage(
    {
      type: "ADD_TO_BOARD",
      payload: { src, pageUrl },
    },
    (res) => {
      // Show in-page toast based on result
      if (res && res.ok) {
        showInlineToast("Captured");
      } else if (res && res.error === "Duplicate") {
        showInlineToast("Already on board");
      } else if (res && res.error === "Board full") {
        showInlineToast("Board is full");
      } else {
        showInlineToast("Failed");
      }
    }
  );
  // Keep overlay visible briefly to avoid flicker during click
  setTimeout(() => {
    if (currentHoveredImg) positionOverlay(currentHoveredImg);
  }, 0);
}

function showInlineToast(text) {
  if (!overlayButton) return;
  if (!inlineToast) {
    inlineToast = document.createElement("div");
    inlineToast.style.position = "fixed";
    inlineToast.style.zIndex = "2147483647";
    inlineToast.style.background = "#111";
    inlineToast.style.color = "#fff";
    inlineToast.style.padding = "4px 8px";
    inlineToast.style.borderRadius = "9999px";
    inlineToast.style.fontSize = "12px";
    inlineToast.style.pointerEvents = "none";
    inlineToast.style.opacity = "0";
    inlineToast.style.transition = "opacity .15s ease";
    document.documentElement.appendChild(inlineToast);
  }
  inlineToast.textContent = text;
  // position above the overlay button
  const btnRect = overlayButton.getBoundingClientRect();
  const ix = btnRect.left + btnRect.width / 2;
  const iy = btnRect.top - 8; // a bit above
  inlineToast.style.left = `${Math.round(ix)}px`;
  inlineToast.style.top = `${Math.round(iy)}px`;
  inlineToast.style.transform = "translate(-50%, -100%)";
  requestAnimationFrame(() => (inlineToast.style.opacity = "1"));
  clearTimeout(showInlineToast._t);
  showInlineToast._t = setTimeout(() => {
    inlineToast.style.opacity = "0";
  }, 1200);
}

// Reposition on scroll/resize in case image moves
addEventListener(
  "scroll",
  () => currentHoveredImg && positionOverlay(currentHoveredImg),
  true
);
addEventListener(
  "resize",
  () => currentHoveredImg && positionOverlay(currentHoveredImg)
);
