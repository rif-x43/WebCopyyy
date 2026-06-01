// WebCopyyy — Background Service Worker (Manifest V3)

// ── Tab unlock state (session-only) ──
async function getUnlockedTabs() {
  const d = await chrome.storage.session.get('unlockedTabs');
  return new Set(d.unlockedTabs || []);
}
async function saveUnlockedTabs(tabs) {
  await chrome.storage.session.set({ unlockedTabs: [...tabs] });
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const t = await getUnlockedTabs();
  if (t.has(tabId)) { t.delete(tabId); await saveUnlockedTabs(t); }
});
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status === 'loading') {
    const t = await getUnlockedTabs();
    if (t.has(tabId)) { t.delete(tabId); await saveUnlockedTabs(t); }
  }
});

// ── Message router ──
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const handlers = {
    getState:          () => handleGetState(msg, respond),
    checkRestrictions: () => handleCheckRestrictions(respond),
    unlockPage:        () => handleUnlock(respond),
    lockPage:          () => handleLock(respond),
    clonePage:         () => handleClone(respond),
    copyFormatted:     () => handleCopyFormatted(respond),
    exportToDocs:      () => handleExportToDocs(respond),
    removeOverlays:    () => handleRemoveOverlays(respond),
  };
  if (handlers[msg.action]) { handlers[msg.action](); return true; }
});

// ── Helpers ──
function isInjectableUrl(url) {
  if (!url) return false;
  return !['chrome://','chrome-extension://','edge://','about:','devtools://','view-source:','chrome-search://','data:']
    .some(function(p) { return url.startsWith(p); });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function guardTab() {
  const tab = await getActiveTab();
  if (!tab) return { error: 'No active tab found' };
  if (!isInjectableUrl(tab.url)) return { error: 'Cannot run on this page' };
  return { tab };
}

// ════════════════════════════════════
// ACTION HANDLERS
// ════════════════════════════════════

async function handleGetState(msg, respond) {
  try {
    const t = await getUnlockedTabs();
    respond({ unlocked: t.has(msg.tabId) });
  } catch (e) { respond({ unlocked: false }); }
}

// NEW: Check if page has copy restrictions
async function handleCheckRestrictions(respond) {
  try {
    const g = await guardTab();
    if (g.error) return respond({ restricted: false, error: g.error });
    const res = await chrome.scripting.executeScript({
      target: { tabId: g.tab.id },
      func: injected_checkRestrictions,
      world: 'MAIN'
    });
    respond(res?.[0]?.result || { restricted: false });
  } catch (e) { respond({ restricted: false }); }
}

async function handleUnlock(respond) {
  try {
    const g = await guardTab();
    if (g.error) return respond({ success: false, error: g.error });
    await chrome.scripting.executeScript({ target: { tabId: g.tab.id }, func: injected_unlock, world: 'MAIN' });
    const t = await getUnlockedTabs(); t.add(g.tab.id); await saveUnlockedTabs(t);
    respond({ success: true });
  } catch (e) { respond({ success: false, error: e.message }); }
}

async function handleLock(respond) {
  try {
    const g = await guardTab();
    if (g.error) return respond({ success: false, error: g.error });
    const t = await getUnlockedTabs(); t.delete(g.tab.id); await saveUnlockedTabs(t);
    await chrome.tabs.reload(g.tab.id);
    respond({ success: true });
  } catch (e) { respond({ success: false, error: e.message }); }
}

async function handleClone(respond) {
  try {
    const g = await guardTab();
    if (g.error) return respond({ success: false, error: g.error });
    const res = await chrome.scripting.executeScript({ target: { tabId: g.tab.id }, func: injected_clone, world: 'MAIN' });
    if (!res?.[0]?.result) return respond({ success: false, error: 'Could not read page' });
    const { html, title } = res[0].result;
    const name = (title || 'page').replace(/[^a-z0-9\s\-_]/gi, '').replace(/\s+/g, '-').substring(0, 60) || 'page';
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    chrome.downloads.download({ url: dataUrl, filename: name + '.html', saveAs: true }, function() {
      if (chrome.runtime.lastError) {
        respond({ success: false, error: chrome.runtime.lastError.message });
      } else {
        respond({ success: true });
      }
    });
  } catch (e) { respond({ success: false, error: e.message }); }
}

async function handleCopyFormatted(respond) {
  try {
    const g = await guardTab();
    if (g.error) return respond({ success: false, error: g.error });

    // Step 1: Extract clean HTML from the page (MAIN world for full DOM access)
    const extractRes = await chrome.scripting.executeScript({
      target: { tabId: g.tab.id },
      func: injected_extractCleanHTML,
      world: 'MAIN'
    });

    var cleanHTML = extractRes && extractRes[0] && extractRes[0].result;
    if (!cleanHTML) return respond({ success: false, error: 'Could not read page content' });

    // Step 2: Write to clipboard via ISOLATED world (has clipboard permission)
    const copyRes = await chrome.scripting.executeScript({
      target: { tabId: g.tab.id },
      func: injected_writeToClipboard,
      args: [cleanHTML],
      world: 'ISOLATED'
    });

    if (copyRes && copyRes[0] && copyRes[0].result && copyRes[0].result.success) {
      respond({ success: true });
    } else {
      respond({ success: false, error: (copyRes && copyRes[0] && copyRes[0].result && copyRes[0].result.error) || 'Clipboard write failed' });
    }
  } catch (e) { respond({ success: false, error: e.message }); }
}

async function handleExportToDocs(respond) {
  try {
    const g = await guardTab();
    if (g.error) return respond({ success: false, error: g.error });

    // Step 1: Extract clean HTML
    const extractRes = await chrome.scripting.executeScript({
      target: { tabId: g.tab.id },
      func: injected_extractCleanHTML,
      world: 'MAIN'
    });

    var cleanHTML = extractRes && extractRes[0] && extractRes[0].result;
    if (!cleanHTML) return respond({ success: false, error: 'Could not read page content' });

    // Step 2: Write to clipboard
    const copyRes = await chrome.scripting.executeScript({
      target: { tabId: g.tab.id },
      func: injected_writeToClipboard,
      args: [cleanHTML],
      world: 'ISOLATED'
    });

    if (!(copyRes && copyRes[0] && copyRes[0].result && copyRes[0].result.success)) {
      return respond({ success: false, error: 'Could not copy content to clipboard' });
    }

    // CRITICAL: respond BEFORE opening new tab (opening tab closes popup, kills port)
    respond({ success: true });

    // Step 3: Small delay to ensure clipboard is committed, then open Google Docs
    setTimeout(function() {
      chrome.tabs.create({ url: 'https://docs.new', active: true });
    }, 200);

  } catch (e) { respond({ success: false, error: e.message }); }
}

async function handleRemoveOverlays(respond) {
  try {
    const g = await guardTab();
    if (g.error) return respond({ success: false, error: g.error });
    const res = await chrome.scripting.executeScript({ target: { tabId: g.tab.id }, func: injected_removeOverlays, world: 'MAIN' });
    respond(res?.[0]?.result || { success: true, count: 0 });
  } catch (e) { respond({ success: false, error: e.message }); }
}


// ════════════════════════════════════
// INJECTED FUNCTIONS
// ════════════════════════════════════

/**
 * Checks if the page has any copy/selection restrictions.
 * Runs in MAIN world to access page's JS handlers.
 */
function injected_checkRestrictions() {
  var found = [];

  // 1. Check CSS user-select on key elements
  var testEls = [document.body, document.documentElement];
  var articles = document.querySelectorAll('article, main, .content, [role="main"], p');
  for (var i = 0; i < Math.min(articles.length, 20); i++) testEls.push(articles[i]);

  for (var i = 0; i < testEls.length; i++) {
    if (!testEls[i]) continue;
    var cs = window.getComputedStyle(testEls[i]);
    if (cs.userSelect === 'none' || cs.webkitUserSelect === 'none') {
      found.push('user-select: none');
      break;
    }
  }

  // 2. Check inline event handler attributes
  var handlers = ['oncopy', 'oncontextmenu', 'onselectstart', 'onpaste'];
  for (var j = 0; j < handlers.length; j++) {
    if (document[handlers[j]] || (document.body && document.body[handlers[j]])) {
      found.push(handlers[j]);
    }
  }

  // Also check body/html attributes
  var bodyAttrs = document.body ? document.body.attributes : [];
  var htmlAttrs = document.documentElement.attributes;
  for (var j = 0; j < handlers.length; j++) {
    for (var k = 0; k < bodyAttrs.length; k++) {
      if (bodyAttrs[k].name === handlers[j]) { found.push(handlers[j] + ' attr'); break; }
    }
    for (var k = 0; k < htmlAttrs.length; k++) {
      if (htmlAttrs[k].name === handlers[j]) { found.push(handlers[j] + ' attr'); break; }
    }
  }

  // 3. Check if right-click is blocked (contextmenu listeners are harder to detect,
  //    but we can check for the attribute or inline handler)
  if (document.body && document.body.getAttribute('oncontextmenu')) {
    found.push('contextmenu blocked');
  }

  return {
    restricted: found.length > 0,
    reasons: found
  };
}


function injected_unlock() {
  var SID = 'webcopy-unlock-styles';
  var old = document.getElementById(SID);
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = SID;
  s.textContent = '*,*::before,*::after{-webkit-user-select:text!important;-moz-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important}';
  document.head.appendChild(s);

  var H = ['oncopy','oncut','onpaste','oncontextmenu','onselectstart','ondragstart'];
  var els = document.querySelectorAll('*');
  for (var i = 0; i < els.length; i++) {
    for (var j = 0; j < H.length; j++) {
      if (els[i][H[j]]) els[i][H[j]] = null;
      if (els[i].hasAttribute(H[j])) els[i].removeAttribute(H[j]);
    }
    if (els[i].style.userSelect) els[i].style.userSelect = '';
    if (els[i].style.webkitUserSelect) els[i].style.webkitUserSelect = '';
  }
  for (var j = 0; j < H.length; j++) {
    document[H[j]] = null;
    if (document.body) document.body[H[j]] = null;
  }

  var BL = ['copy','cut','paste','contextmenu','selectstart','dragstart'];
  if (!window.__wcPatched) {
    window.__wcPatched = true;
    for (var k = 0; k < BL.length; k++) {
      document.addEventListener(BL[k], function(e){ e.stopImmediatePropagation(); }, true);
    }
    var origAdd = EventTarget.prototype.addEventListener;
    var blocked = new Set(BL);
    EventTarget.prototype.addEventListener = function(t,f,o) {
      if (blocked.has(t)) return;
      return origAdd.call(this,t,f,o);
    };
  }

  // Toast
  var TID = 'webcopy-toast';
  var ot = document.getElementById(TID);
  if (ot) ot.remove();
  var toast = document.createElement('div');
  toast.id = TID;
  toast.textContent = '\u{1F513} WebCopyyy: Page Unlocked';
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:11px 20px;border-radius:10px;font:600 12px/1 Inter,system-ui,sans-serif;box-shadow:0 6px 24px rgba(102,126,234,0.35);border:1px solid rgba(255,255,255,0.15);opacity:0;transform:translateY(12px);transition:opacity .3s,transform .3s;';
  document.body.appendChild(toast);
  requestAnimationFrame(function(){ toast.style.opacity='1'; toast.style.transform='translateY(0)'; });
  setTimeout(function(){ toast.style.opacity='0'; toast.style.transform='translateY(12px)'; setTimeout(function(){ toast.remove(); },300); },2000);
}


/**
 * Extracts clean, semantic-only HTML from the page.
 * Runs in MAIN world to access the full live DOM.
 * Strips ALL styles, classes, backgrounds — keeps only structure and links.
 * Returns a clean HTML string.
 */
function injected_extractCleanHTML() {
  // Tags whose content we keep and wrap
  var KEEP = {
    'H1':1,'H2':1,'H3':1,'H4':1,'H5':1,'H6':1,
    'P':1,'BR':1,'HR':1,
    'STRONG':1,'B':1,'EM':1,'I':1,'U':1,'S':1,'SUB':1,'SUP':1,
    'A':1,'BLOCKQUOTE':1,'PRE':1,'CODE':1,
    'UL':1,'OL':1,'LI':1,
    'TABLE':1,'THEAD':1,'TBODY':1,'TFOOT':1,'TR':1,'TH':1,'TD':1,'CAPTION':1,
    'IMG':1,'FIGURE':1,'FIGCAPTION':1,
    'DL':1,'DT':1,'DD':1,'MARK':1,'ABBR':1
  };

  // Tags to skip entirely (including all children)
  var SKIP = {
    'SCRIPT':1,'NOSCRIPT':1,'STYLE':1,'SVG':1,'CANVAS':1,'IFRAME':1,
    'NAV':1,'FOOTER':1,'ASIDE':1,'INPUT':1,'BUTTON':1,'SELECT':1,
    'TEXTAREA':1,'FORM':1,'LABEL':1,'FIELDSET':1,'LEGEND':1,
    'VIDEO':1,'AUDIO':1,'OBJECT':1,'EMBED':1,'MAP':1,'AREA':1
  };

  // Transparent/pass-through: we keep children but don't wrap in a tag
  // DIV, SPAN, SECTION, ARTICLE, MAIN, HEADER (inside body), etc.

  var baseUrl = window.location.href;

  function resolveUrl(url) {
    if (!url) return '';
    try { return new URL(url, baseUrl).href; } catch(e) { return url; }
  }

  function escapeAttr(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  function clean(node) {
    // Text node
    if (node.nodeType === 3) {
      var text = node.textContent;
      // Collapse whitespace for non-pre contexts
      return text;
    }

    // Not an element
    if (node.nodeType !== 1) return '';

    var tag = node.tagName;

    // Skip noise
    if (SKIP[tag]) return '';
    if (node.id === 'webcopy-toast' || node.id === 'webcopy-unlock-styles') return '';

    // Skip hidden elements
    if (node.getAttribute('aria-hidden') === 'true') return '';
    var style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return '';

    // Self-closing tags
    if (tag === 'BR') return '<br>';
    if (tag === 'HR') return '<hr>';
    if (tag === 'IMG') {
      var src = resolveUrl(node.getAttribute('src'));
      var alt = escapeAttr(node.getAttribute('alt'));
      if (src) return '<img src="' + escapeAttr(src) + '" alt="' + alt + '">';
      return '';
    }

    // Build children content
    var inner = '';
    for (var i = 0; i < node.childNodes.length; i++) {
      inner += clean(node.childNodes[i]);
    }

    // Skip empty elements (except BR/HR handled above)
    if (!inner.trim()) return '';

    // Links — keep href
    if (tag === 'A') {
      var href = node.getAttribute('href') || '';
      if (href && href.indexOf('javascript:') !== 0 && href.charAt(0) !== '#') {
        href = resolveUrl(href);
        return '<a href="' + escapeAttr(href) + '">' + inner + '</a>';
      }
      return inner; // strip dead links, keep content
    }

    // Known semantic tags — wrap
    if (KEEP[tag]) {
      var t = tag.toLowerCase();
      return '<' + t + '>' + inner + '</' + t + '>';
    }

    // DIV / SECTION / ARTICLE / MAIN / SPAN / HEADER etc. → pass through as <div> or inline
    // Block-level pass-throughs get a div, inline ones get nothing
    var blockish = (style.display === 'block' || style.display === 'flex' ||
                    style.display === 'grid' || style.display === 'table' ||
                    tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' ||
                    tag === 'MAIN' || tag === 'HEADER');

    if (blockish) {
      return '<div>' + inner + '</div>';
    }
    return inner; // inline pass-through (SPAN etc.)
  }

  var result = clean(document.body);

  // Show toast
  var TID = 'webcopy-toast';
  var ot = document.getElementById(TID);
  if (ot) ot.remove();
  var toast = document.createElement('div');
  toast.id = TID;
  toast.textContent = '\u{1F4CB} Content copied!';
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:11px 20px;border-radius:10px;font:600 12px/1 Inter,system-ui,sans-serif;box-shadow:0 6px 24px rgba(102,126,234,0.35);border:1px solid rgba(255,255,255,0.15);opacity:0;transform:translateY(12px);transition:opacity .3s,transform .3s;';
  document.body.appendChild(toast);
  requestAnimationFrame(function(){ toast.style.opacity='1'; toast.style.transform='translateY(0)'; });
  setTimeout(function(){ toast.style.opacity='0'; toast.style.transform='translateY(12px)'; setTimeout(function(){ toast.remove(); },300); },2000);

  return result;
}


/**
 * Writes clean HTML string to clipboard as rich text.
 * Runs in ISOLATED world where clipboardWrite permission grants access.
 * Receives the clean HTML string as the first argument.
 */
function injected_writeToClipboard(cleanHTML) {
  try {
    // Create an offscreen container with the clean content
    var container = document.createElement('div');
    container.innerHTML = cleanHTML;
    // Must be in the visible area (not display:none) for execCommand to work
    container.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0.01;';
    document.body.appendChild(container);

    // Select all content in the container
    var sel = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(container);
    sel.removeAllRanges();
    sel.addRange(range);

    // Copy — with clipboardWrite permission this works without user gesture
    var ok = document.execCommand('copy');

    // Cleanup
    sel.removeAllRanges();
    container.remove();

    return { success: ok, error: ok ? null : 'execCommand returned false' };
  } catch (e) {
    return { success: false, error: e.message || 'Clipboard write failed' };
  }
}


function injected_removeOverlays() {
  var count = 0;
  var all = document.querySelectorAll('*');

  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var cs = window.getComputedStyle(el);
    var pos = cs.position;
    var zIndex = parseInt(cs.zIndex) || 0;

    if ((pos === 'fixed' || pos === 'sticky') && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
      var rect = el.getBoundingClientRect();
      var area = rect.width * rect.height;
      var screenArea = window.innerWidth * window.innerHeight;

      if (area > screenArea * 0.3 || zIndex > 999) {
        el.remove(); count++; continue;
      }

      var cls = (el.className || '').toString().toLowerCase();
      var id = (el.id || '').toLowerCase();
      var patterns = ['modal','overlay','popup','paywall','cookie','consent','banner','subscribe','signup','login-wall','gate','interstitial','backdrop','lightbox','dialog'];
      for (var p = 0; p < patterns.length; p++) {
        if (cls.indexOf(patterns[p]) !== -1 || id.indexOf(patterns[p]) !== -1) {
          el.remove(); count++; break;
        }
      }
    }
  }

  document.documentElement.style.overflow = 'auto';
  document.body.style.overflow = 'auto';
  document.documentElement.style.position = '';
  document.body.style.position = '';
  document.documentElement.classList.remove('no-scroll','noscroll','modal-open','overflow-hidden');
  document.body.classList.remove('no-scroll','noscroll','modal-open','overflow-hidden');

  var main = document.querySelectorAll('main,article,[role="main"],.content,.main-content,#content,#main');
  for (var m = 0; m < main.length; m++) {
    main[m].style.filter = 'none';
    main[m].style.webkitFilter = 'none';
    main[m].style.pointerEvents = 'auto';
  }

  var TID = 'webcopy-toast';
  var ot = document.getElementById(TID);
  if (ot) ot.remove();
  var toast = document.createElement('div');
  toast.id = TID;
  toast.textContent = '\u{1F9F9} Removed ' + count + ' overlay(s)';
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:11px 20px;border-radius:10px;font:600 12px/1 Inter,system-ui,sans-serif;box-shadow:0 6px 24px rgba(102,126,234,0.35);border:1px solid rgba(255,255,255,0.15);opacity:0;transform:translateY(12px);transition:opacity .3s,transform .3s;';
  document.body.appendChild(toast);
  requestAnimationFrame(function(){ toast.style.opacity='1'; toast.style.transform='translateY(0)'; });
  setTimeout(function(){ toast.style.opacity='0'; toast.style.transform='translateY(12px)'; setTimeout(function(){ toast.remove(); },300); },2000);

  return { success: true, count: count };
}


function injected_clone() {
  var baseUrl = window.location.href;
  var doc = document.documentElement.cloneNode(true);
  var rm = doc.querySelectorAll('script,noscript,#webcopy-unlock-styles,#webcopy-toast');
  for (var i = 0; i < rm.length; i++) rm[i].remove();

  function resolve(u) { try { return new URL(u,baseUrl).href; } catch(e) { return u; } }

  var imgs = doc.querySelectorAll('img[src]');
  for (var i = 0; i < imgs.length; i++) imgs[i].setAttribute('src', resolve(imgs[i].getAttribute('src')));

  var srcsets = doc.querySelectorAll('[srcset]');
  for (var i = 0; i < srcsets.length; i++) {
    srcsets[i].setAttribute('srcset', srcsets[i].getAttribute('srcset').replace(/(\S+)(\s+[\d.]+[wx])/g, function(m,u,d){ return resolve(u)+d; }));
  }

  var links = doc.querySelectorAll('a[href]');
  for (var i = 0; i < links.length; i++) {
    var h = links[i].getAttribute('href');
    if (h && h.charAt(0)!=='#' && h.indexOf('javascript:')!==0) links[i].setAttribute('href', resolve(h));
  }

  var css = doc.querySelectorAll('link[rel="stylesheet"][href]');
  for (var i = 0; i < css.length; i++) css[i].setAttribute('href', resolve(css[i].getAttribute('href')));

  var srcs = doc.querySelectorAll('source[src]');
  for (var i = 0; i < srcs.length; i++) srcs[i].setAttribute('src', resolve(srcs[i].getAttribute('src')));

  var styled = doc.querySelectorAll('[style]');
  for (var i = 0; i < styled.length; i++) {
    var s = styled[i].getAttribute('style');
    if (s && s.indexOf('url(')!==-1) {
      styled[i].setAttribute('style', s.replace(/url\(['"]?([^'")]+)['"]?\)/g, function(m,u){ return "url('"+resolve(u)+"')"; }));
    }
  }

  if (!doc.querySelector('base')) {
    var head = doc.querySelector('head');
    if (head) { var b = document.createElement('base'); b.setAttribute('href',baseUrl); head.insertBefore(b,head.firstChild); }
  }

  var us = document.createElement('style');
  us.textContent = '*{-webkit-user-select:text!important;user-select:text!important}';
  var hd = doc.querySelector('head');
  if (hd) hd.appendChild(us);

  var hs = ['oncopy','oncut','onpaste','oncontextmenu','onselectstart','ondragstart'];
  var all = doc.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) for (var j = 0; j < hs.length; j++) all[i].removeAttribute(hs[j]);

  return { html: '<!DOCTYPE html>\n' + doc.outerHTML, title: document.title };
}
