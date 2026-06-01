// WebCopyyy — Popup Controller
document.addEventListener('DOMContentLoaded', async () => {
  // ── DOM refs ──
  const toggle         = document.getElementById('unlockToggle');
  const toggleLabel    = document.getElementById('toggleLabel');
  const toggleHint     = document.getElementById('toggleHint');
  const toggleStatus   = document.getElementById('toggleStatus');
  const copyBtn        = document.getElementById('copyFormattedBtn');
  const docsBtn        = document.getElementById('exportDocsBtn');
  const cloneBtn       = document.getElementById('cloneBtn');
  const overlaysBtn    = document.getElementById('removeOverlaysBtn');
  const globalStatus   = document.getElementById('globalStatus');
  const detailsBtn     = document.getElementById('detailsToggle');
  const detailsBody    = document.getElementById('detailsBody');
  const chevron        = document.getElementById('detailsChevron');

  let isUnlocked = false;
  let busy = false;
  let toggleTimer = null;
  let globalTimer = null;
  let pageRestricted = true; // assume restricted until checked

  const allFeatureButtons = [copyBtn, docsBtn, cloneBtn, overlaysBtn];

  // ── Init ──
  try {
    const tab = await getCurrentTab();

    // Check if page is injectable
    if (!tab || !isInjectable(tab.url)) {
      toggle.disabled = true;
      allFeatureButtons.forEach(function(b) { b.disabled = true; });
      toggleLabel.textContent = 'Unavailable';
      toggleHint.textContent = 'Not available on this page';
      return; // Stop init
    }

    // Check if already unlocked (from previous toggle)
    if (tab.id) {
      const stateResp = await msg({ action: 'getState', tabId: tab.id });
      if (stateResp && stateResp.unlocked) {
        isUnlocked = true;
        applyToggleUI();
      }
    }

    // Check if page has copy restrictions
    if (!isUnlocked) {
      const restrictResp = await msg({ action: 'checkRestrictions' });
      if (restrictResp && !restrictResp.restricted) {
        // Page has NO restrictions — auto-show as unlocked, disable toggle
        pageRestricted = false;
        toggle.classList.add('active');
        toggle.disabled = true;
        toggle.setAttribute('aria-checked', 'true');
        toggleLabel.textContent = 'No Restrictions';
        toggleHint.textContent = 'This page allows copying freely';
        showToggleStatus('✓ Page is already unrestricted', 'success', 4000);
      }
    }

  } catch (e) {
    // Popup still works even if init checks fail
  }

  // ── Toggle click ──
  toggle.addEventListener('click', async () => {
    if (busy || !pageRestricted) return;
    busy = true;
    toggle.disabled = true;

    if (isUnlocked) {
      showToggleStatus('Restoring…', 'working');
      const r = await msg({ action: 'lockPage' });
      if (r && r.success) {
        isUnlocked = false;
        applyToggleUI();
        showToggleStatus('Page restored', 'success', 2500);
      } else {
        showToggleStatus((r && r.error) || 'Failed', 'error', 3500);
      }
    } else {
      showToggleStatus('Unlocking…', 'working');
      const r = await msg({ action: 'unlockPage' });
      if (r && r.success) {
        isUnlocked = true;
        applyToggleUI();
        showToggleStatus('Unlocked — copy freely!', 'success', 3000);
      } else {
        showToggleStatus((r && r.error) || 'Failed', 'error', 3500);
      }
    }

    toggle.disabled = false;
    busy = false;
  });

  // ── Copy Formatted ──
  copyBtn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    copyBtn.disabled = true;
    showGlobal('Copying formatted content…', 'working');

    const r = await msg({ action: 'copyFormatted' });
    if (r && r.success) {
      showGlobal('Copied to clipboard ✓', 'success', 3000);
      flash(copyBtn);
    } else {
      showGlobal((r && r.error) || 'Copy failed', 'error', 3500);
    }

    copyBtn.disabled = false;
    busy = false;
  });

  // ── Export to Google Docs ──
  docsBtn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    docsBtn.disabled = true;
    showGlobal('Preparing for Google Docs…', 'working');

    const r = await msg({ action: 'exportToDocs' });
    if (r && r.success) {
      showGlobal('Copied! Paste (Ctrl+V) into the new Doc', 'success', 5000);
      flash(docsBtn);
    } else {
      showGlobal((r && r.error) || 'Export failed', 'error', 3500);
    }

    docsBtn.disabled = false;
    busy = false;
  });

  // ── Save Page Copy ──
  cloneBtn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    cloneBtn.disabled = true;
    showGlobal('Saving page…', 'working');

    const r = await msg({ action: 'clonePage' });
    if (r && r.success) {
      showGlobal('Page saved!', 'success', 3000);
      flash(cloneBtn);
    } else {
      showGlobal((r && r.error) || 'Save failed', 'error', 3500);
    }

    cloneBtn.disabled = false;
    busy = false;
  });

  // ── Remove Overlays ──
  overlaysBtn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    overlaysBtn.disabled = true;
    showGlobal('Removing overlays…', 'working');

    const r = await msg({ action: 'removeOverlays' });
    if (r && r.success) {
      var countMsg = r.count ? 'Removed ' + r.count + ' overlay(s) ✓' : 'Page cleaned ✓';
      showGlobal(countMsg, 'success', 3000);
      flash(overlaysBtn);
    } else {
      showGlobal((r && r.error) || 'Failed', 'error', 3500);
    }

    overlaysBtn.disabled = false;
    busy = false;
  });

  // ── Details toggle ──
  var detailsOpen = false;
  detailsBtn.addEventListener('click', () => {
    detailsOpen = !detailsOpen;
    detailsBody.classList.toggle('open', detailsOpen);
    chevron.classList.toggle('open', detailsOpen);
  });

  // ═══ Helpers ═══

  function applyToggleUI() {
    toggle.classList.toggle('active', isUnlocked);
    toggle.setAttribute('aria-checked', String(isUnlocked));
    toggleLabel.textContent = isUnlocked ? 'Page Unlocked' : 'Page Locked';
    toggleHint.textContent  = isUnlocked ? 'Copying & right-click enabled' : 'Enable copying & right-click';
  }

  function showToggleStatus(text, type, autoClear) {
    if (toggleTimer) clearTimeout(toggleTimer);
    toggleStatus.textContent = text;
    toggleStatus.className = 'toggle-status visible ' + type;
    if (autoClear) {
      toggleTimer = setTimeout(function() {
        toggleStatus.classList.remove('visible');
      }, autoClear);
    }
  }

  function showGlobal(text, type, autoClear) {
    if (globalTimer) clearTimeout(globalTimer);
    globalStatus.textContent = text;
    globalStatus.className = 'global-status visible ' + type;
    if (autoClear) {
      globalTimer = setTimeout(function() {
        globalStatus.classList.remove('visible');
      }, autoClear);
    }
  }

  function flash(btn) {
    btn.classList.add('flash-success');
    setTimeout(function() { btn.classList.remove('flash-success'); }, 700);
  }

  function msg(data) {
    return new Promise(function(resolve) {
      chrome.runtime.sendMessage(data, function(r) {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(r);
        }
      });
    });
  }

  function getCurrentTab() {
    return new Promise(function(resolve) {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        resolve(tabs[0] || null);
      });
    });
  }

  function isInjectable(url) {
    if (!url) return false;
    var blocked = ['chrome://','chrome-extension://','edge://','about:','devtools://','view-source:','data:','file://'];
    for (var i = 0; i < blocked.length; i++) {
      if (url.startsWith(blocked[i])) return false;
    }
    return true;
  }
});
