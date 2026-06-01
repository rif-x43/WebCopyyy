# 🔓 WebCopyyy

**Remove copy restrictions. Reclaim your content. Save pages as editable HTML.**

A powerful browser extension that disables copy restrictions, re-enables right-click, and unlocks text selection on any website—all with a single click.

---

## ✨ Features

### 🔑 Unlock & Copy
- **Remove copy protection** — Disable CSS `user-select: none` and event handlers blocking copy/cut/paste
- **Re-enable right-click** — Access context menus on restricted websites
- **Unlock text selection** — Select any text, even on protected content
- **Patch event listeners** — Prevent websites from re-blocking restrictions

### 💾 Save & Export
- **Download as HTML** — Clone entire pages as fully functional HTML files ready to edit
- **Copy formatted content** — Extract clean, semantic HTML from pages (strips styles, ads, clutter)
- **One-click Google Docs export** — Copy rich content and open Google Docs in one action
- **Preserve structure** — Maintains headings, links, images, tables, and semantic elements

### 🎯 Smart Controls
- **Detect restrictions** — Check if a page has copy/selection protections before unlocking
- **Remove overlays** — Dismiss modal dialogs, paywalls, and floating popups
- **Per-tab memory** — Your unlock state resets when you navigate (session-based)
- **Lock/unlock toggle** — Re-lock pages to restore original restrictions if needed

---

## 📦 What's Inside

```
WebCopyyy_v1.0.0/
├── manifest.json           # Chrome extension configuration
├── background.js           # Service worker with core unlock logic
├── popup/                  # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── icons/                  # Extension icons (16, 32, 48, 128px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
```

---

## 🚀 Installation

### From Source (Chrome/Edge)

1. **Clone or download** this repository
2. Open `chrome://extensions` in your browser
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `WebCopyyy_v1.0.0` folder
6. ✅ Done! The extension is now installed

### Manual Setup
- Ensure you have the latest version of Chrome, Edge, or Brave
- All permissions are declared in `manifest.json` (no hidden access)

---

## 🎮 How to Use

### Basic Workflow

1. **Visit any website** with copy restrictions
2. **Click the WebCopyyy icon** in your browser toolbar
3. **Choose an action:**
   - 🔓 **Unlock Page** — Re-enable copy, right-click, and text selection
   - 💾 **Download as HTML** — Save the entire page as an editable file
   - 📋 **Copy Formatted** — Extract clean HTML content to clipboard
   - 📄 **Export to Google Docs** — Copy and open Docs in one step
   - 🗑️ **Remove Overlays** — Dismiss modals and paywalls
   - 🔒 **Lock Page** — Restore original restrictions

### Real-World Examples

| Scenario | Solution |
|----------|----------|
| Can't copy text from an article | Click **Unlock Page** → copy normally |
| Right-click disabled on a website | Click **Unlock Page** → right-click works |
| Want to save a page for offline editing | Click **Download as HTML** → save `.html` file |
| Need clean content without ads | Click **Copy Formatted** → paste into Docs/Editor |
| Paywall popup blocking content | Click **Remove Overlays** → popup disappears |

---

## 🛠️ Technical Details

### Permissions Used
- **`activeTab`** — Access current browser tab
- **`scripting`** — Run code to unlock restrictions
- **`storage`** — Remember per-tab unlock state
- **`downloads`** — Save pages as HTML files
- **`clipboardWrite`** — Copy content to clipboard

### Architecture
- **Manifest V3** — Modern, secure extension standard
- **Service Worker** — Background logic for unlock operations
- **Content Injection** — Runs code in page's main world for full DOM access
- **Two-world execution** — MAIN world for DOM access, ISOLATED world for clipboard

### Key Functions

| Function | Purpose |
|----------|---------|
| `injected_unlock()` | Removes user-select CSS, clears event handlers |
| `injected_extractCleanHTML()` | Extracts semantic HTML, strips styles |
| `injected_checkRestrictions()` | Detects copy/selection protections |
| `injected_removeOverlays()` | Removes fixed/sticky positioned overlays |
| `injected_clone()` | Creates full-page snapshot with resolved URLs |

---

## 💡 How It Works

### Unlock Mechanism
1. Injects a global stylesheet that overrides `user-select: none`
2. Removes all event listeners for `copy`, `cut`, `paste`, `contextmenu`, `selectstart`, `dragstart`
3. Patches `EventTarget.prototype.addEventListener` to block re-registration
4. Displays a toast notification confirming unlock

### Content Extraction
1. Traverses the DOM recursively
2. Keeps semantic tags (headings, paragraphs, lists, tables, links)
3. Strips all styling, classes, and non-content elements
4. Resolves relative URLs to absolute URLs
5. Returns clean, portable HTML

### Overlay Removal
1. Finds all fixed/sticky positioned elements
2. Removes large overlays (>30% screen area) or high z-index (>999)
3. Detects common patterns: "modal", "popup", "paywall", "cookie", etc.
4. Restores document scrolling and visibility

---

## ⚙️ Configuration

No configuration needed! The extension works out of the box. All state is session-based and resets when you close the browser or navigate away.

---

## 🔒 Privacy & Security

✅ **No data collection** — Everything runs locally in your browser  
✅ **No background tracking** — Service worker only activates on user action  
✅ **No external calls** — All logic is self-contained  
✅ **Open source** — Full transparency on what the code does  

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not appearing | Ensure it's enabled at `chrome://extensions` |
| Copy still not working | Some sites may have additional protections; try **Remove Overlays** first |
| HTML download shows errors | Click **Download as HTML** again; some sites need multiple attempts |
| "Cannot run on this page" | Extension doesn't work on special pages (Chrome store, settings, etc.) |

---

## 🤝 Contributing

Found a bug? Have an idea? Feel free to open an issue or fork this repo!

---

## 📄 License

Open source. Use freely, modify as you wish, credit appreciated.

---

## 🎯 Version

**WebCopyyy v1.0.0** — First release  
Built with Manifest V3 for Chrome, Edge, and Brave browsers

---

**Made with ❤️ to reclaim your digital freedom**
