# GitHub PR Extractor

A cross-platform browser extension that extracts titles with links from any GitHub page. PRs, Issues, Milestones, Repositories, Releases — hover to copy one, or use the popup to bulk-copy all visible items.

Works on **Chrome** and **Firefox**.

## Features

### Inline Copy (Hover)

Hover over any title on GitHub and a small copy button appears to the left. Click it to copy the title as a **rich text link** — paste into Slack, Notion, or Google Docs and it renders as a clickable link.

- Works on PRs, Issues, Repos, Releases, Milestones, Discussions, Commits — any link on any GitHub page
- Copies as rich text (`text/html`) for Slack/Notion + Markdown fallback for plain text editors
- PR/Issue numbers appended at the end: `Fix duplicate accounts #3922`

### Popup (Bulk Extract)

Click the extension icon to extract all visible items on the current page.

- Filter items with the search bar
- Select/deselect individual items with checkboxes
- Copy in 4 formats:
  - **Markdown** — `- [Title #3922](url)` (rich text + Markdown)
  - **Plain** — `Title #3922 — url`
  - **HTML** — `<a href="url">Title #3922</a>`
  - **CSV** — `Title,#3922,url`
- Toggle `#numbers` on/off

### Supported Pages

| Page | URL |
|------|-----|
| Pull Requests | `/:owner/:repo/pulls` |
| Issues | `/:owner/:repo/issues` |
| Milestone items | `/:owner/:repo/milestone/:id` |
| Milestones list | `/:owner/:repo/milestones` |
| Repositories | `/:user?tab=repositories` |
| Stars | `/:user/stars` |
| Trending | `/trending` |
| Releases | `/:owner/:repo/releases` |
| Tags | `/:owner/:repo/tags` |
| Branches | `/:owner/:repo/branches` |
| Discussions | `/:owner/:repo/discussions` |
| Commits | `/:owner/:repo/commits` |
| Actions | `/:owner/:repo/actions` |
| Search results | `/search?q=...` |
| **Any GitHub page** | Generic fallback extracts title links automatically |

## Installation

### Chrome

1. Clone or download this repo
2. Run the build: `bash scripts/build.sh`
3. Open `chrome://extensions`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked** → select the `dist/chrome/` folder

### Firefox

1. Clone or download this repo
2. Run the build: `bash scripts/build.sh`
3. Open `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on** → select `dist/firefox/manifest.json`

## Build

```bash
bash scripts/build.sh
```

Outputs:

```
dist/chrome/                         # Unpacked Chrome extension
dist/firefox/                        # Unpacked Firefox extension
dist/github-pr-extractor-chrome.zip  # Chrome Web Store package
dist/github-pr-extractor-firefox.zip # Firefox Add-ons package
```

## Project Structure

```
src/
  manifest.json                # Manifest V3 (Chrome + Firefox gecko settings)
  content/content.js           # Page extraction + inline copy button
  popup/popup.html             # Popup UI
  popup/popup.css              # GitHub-native dark theme
  popup/popup.js               # Popup logic, formatting, clipboard
  background/service-worker.js # Badge/tooltip management
  icons/icon-{16,32,48,128}.png
scripts/
  build.sh                     # Build + package for both browsers
```

## How It Works

### Inline Copy Button
Uses event delegation (`mouseover` on `document`) to detect when you hover over any GitHub link that points to a PR, issue, repo, release, etc. A floating copy button appears to the left of the title. No DOM manipulation or selector guessing — works on any page layout.

### Popup Extraction
Page-specific extractors handle known page types (PRs, issues, milestones, repos, etc.) with targeted selectors. A generic fallback catches everything else by looking for prominent links (`Link--primary`, `markdown-title`, heading links, hovercard links) inside list containers.

### Clipboard Format
Copies both `text/html` and `text/plain` MIME types using the Clipboard API:
- **Rich text apps** (Slack, Notion, Google Docs) read the HTML → render clickable links
- **Plain text editors** (VS Code, terminal) get the Markdown fallback

## Cross-Browser Compatibility

- **Chrome**: Manifest V3 with `service_worker` background
- **Firefox**: Manifest V3 with `background.scripts` (patched during build)
- **Firefox gecko ID**: Included in `browser_specific_settings` for add-on signing

## Author

Built by [@mrx-arafat](https://github.com/mrx-arafat)

## License

MIT
