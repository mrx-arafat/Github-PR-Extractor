"use strict";

/**
 * GitHub Extractor — Content Script
 *
 * Universal extraction: works on ANY GitHub list page.
 * PRs, Issues, Repos, Stars, Releases, Branches, Tags,
 * Milestones, Search results, Discussions, Commits, etc.
 *
 * Strategy:
 *   1. Try page-specific extractors first (most accurate)
 *   2. Fall back to generic extraction (finds prominent links in lists)
 */

// ============================================================
// Extraction Engine
// ============================================================

function extractLinks(doc, selectors, hrefPattern) {
  const seen = new Set();
  const items = [];

  for (const selector of selectors) {
    for (const link of doc.querySelectorAll(selector)) {
      const href = link.getAttribute("href");
      if (!href || seen.has(href)) continue;
      if (hrefPattern && !hrefPattern.test(href)) continue;

      const title = link.textContent.trim();
      if (!title) continue;

      seen.add(href);
      items.push({
        title,
        url: new URL(href, window.location.origin).href,
        number: extractNumber(href),
      });
    }
  }

  return items;
}

function extractNumber(href) {
  const match = href.match(/\/(?:pull|issues)\/(\d+)/);
  return match ? `#${match[1]}` : null;
}

// ---- Page-Specific Extractors ----

const EXTRACTORS = {
  issueOrPr(doc) {
    return extractLinks(
      doc,
      [
        // Legacy selectors
        '[id^="issue_"] .Link--primary',
        '[id^="issue_"] a.markdown-title',
        '[id^="issue_"] a.js-navigation-open',
        '.js-issue-row .Link--primary',
        '.js-issue-row a.markdown-title',
        '.js-issue-row a.js-navigation-open',
        // React-based UI
        '[data-testid="issue-row"] a[data-testid="issue-title-link"]',
        '[data-testid="list-row"] a[data-testid="issue-title-link"]',
        '[data-testid="list-row"] a[data-testid="pull-request-title-link"]',
        '.js-navigation-container .Link--primary[href*="/pull/"]',
        '.js-navigation-container .Link--primary[href*="/issues/"]',
        '.js-issue-row a[data-hovercard-type="pull_request"]',
        '.js-issue-row a[data-hovercard-type="issue"]',
        '.listRow a.Link--primary[href*="/issues/"]',
        '.listRow a.Link--primary[href*="/pull/"]',
        'div[data-id] a.Link--primary[href*="/issues/"]',
        'div[data-id] a.Link--primary[href*="/pull/"]',
        // Broad fallback for markdown-title links
        'a.markdown-title[href*="/pull/"]',
        'a.markdown-title[href*="/issues/"]',
        'a.js-navigation-open[href*="/pull/"]',
        'a.js-navigation-open[href*="/issues/"]',
      ],
      /\/(pull|issues)\/\d+/
    );
  },

  milestone(doc) {
    return extractLinks(
      doc,
      [
        // Milestone page title links (multiple class combos)
        '[id^="issue_"] a.markdown-title',
        '[id^="issue_"] a.js-navigation-open',
        '[id^="issue_"] .Link--primary',
        '.js-issue-row a.markdown-title',
        '.js-issue-row a.js-navigation-open',
        '.js-issue-row .Link--primary',
        // React-based selectors
        '[data-testid="issue-row"] a[data-testid="issue-title-link"]',
        '[data-testid="list-row"] a[data-testid="issue-title-link"]',
        '[data-testid="list-row"] a[data-testid="pull-request-title-link"]',
        'div[data-id] a.Link--primary[href*="/issues/"]',
        'div[data-id] a.Link--primary[href*="/pull/"]',
        // Broad: any link to a PR/issue inside the milestone list
        'a.markdown-title[href*="/pull/"]',
        'a.markdown-title[href*="/issues/"]',
        'a.js-navigation-open[href*="/pull/"]',
        'a.js-navigation-open[href*="/issues/"]',
      ],
      /\/(pull|issues)\/\d+/
    );
  },

  milestonesList(doc) {
    return extractLinks(
      doc,
      [
        "a.Link--primary[href*='/milestone/']",
        "a[href*='/milestone/'].Link--primary",
      ],
      /\/milestone\//
    );
  },

  projects(doc) {
    return extractLinks(
      doc,
      [
        "a.Link--primary[href*='/projects/']",
        "a[href*='/projects/'].Link--primary",
      ],
      /\/projects\//
    );
  },

  repositories(doc) {
    return extractLinks(
      doc,
      [
        // User/org repo list
        '[itemprop="name codeRepository"] a',
        'a[itemprop="name codeRepository"]',
        'h3 a[href*="/"][data-hovercard-type="repository"]',
        // Repo list on profile tab
        '#user-repositories-list h3 a',
        '.org-repos h3 a',
        // Search results
        '.repo-list h3 a',
        '.search-title a[href*="/"]',
        // Starred repos
        '.d-block h3 a[href*="/"]',
        // Explore / trending
        'article h3 a[href*="/"]',
        'h3 a.Link[href*="/"]',
        // Generic repo links with hovercard
        'a[data-hovercard-type="repository"]',
      ],
      /^\/[^/]+\/[^/]+\/?$/
    );
  },

  releases(doc) {
    return extractLinks(
      doc,
      [
        '.release .Link--primary',
        '[data-testid="release-card"] a.Link--primary',
        '.Box-row h2 a',
        'a[href*="/releases/tag/"]',
      ],
      /\/releases\/tag\//
    );
  },

  tags(doc) {
    return extractLinks(
      doc,
      [
        '.Box-row a.Link--primary[href*="/tree/"]',
        '.Box-row h4 a',
        'a.Link--primary[href*="/releases/tag/"]',
      ],
      null
    );
  },

  branches(doc) {
    return extractLinks(
      doc,
      [
        '.branch-name a',
        'a[href*="/tree/"].branch-name',
        '.Box-row a.Link--primary[href*="/tree/"]',
      ],
      /\/tree\//
    );
  },

  discussions(doc) {
    return extractLinks(
      doc,
      [
        'a[data-hovercard-type="discussion"]',
        '.Link--primary[href*="/discussions/"]',
      ],
      /\/discussions\/\d+/
    );
  },

  commits(doc) {
    return extractLinks(
      doc,
      [
        'a.Link--primary[href*="/commit/"]',
        '.js-commits-list-item a.Link--primary',
        '.TimelineItem a.Link--primary[href*="/commit/"]',
      ],
      /\/commit\//
    );
  },

  actions(doc) {
    return extractLinks(
      doc,
      [
        '.Box-row a.Link--primary[href*="/actions/runs/"]',
        'a[href*="/actions/runs/"].Link--primary',
      ],
      /\/actions\/runs\//
    );
  },

  packages(doc) {
    return extractLinks(
      doc,
      [
        'a.Link--primary[href*="/packages/"]',
      ],
      /\/packages\//
    );
  },

  gists(doc) {
    return extractLinks(
      doc,
      [
        '.gist-snippet .Link--primary',
        'a.Link--primary[href*="gist.github.com"]',
        '.css-truncate a[href*="/"]',
      ],
      null
    );
  },
};

// ---- Generic Fallback Extractor ----

function genericExtract(doc) {
  const seen = new Set();
  const items = [];
  const currentPath = window.location.pathname;

  // Aggressively find ALL title-like links on the page.
  const candidates = doc.querySelectorAll([
    // GitHub's known title/primary classes
    'a.Link--primary',
    'a.markdown-title',
    'a.js-navigation-open',
    // Hovercard links (repos, PRs, issues, users, etc.)
    'a[data-hovercard-type]',
    // Links inside list containers
    '.Box-row a[href^="/"]',
    '[role="row"] a[href^="/"]',
    '[id^="issue_"] a[href^="/"]',
    '.js-issue-row a[href^="/"]',
    '[data-testid] a[href^="/"]',
    // Links inside headings (common title pattern)
    'h1 a[href^="/"]',
    'h2 a[href^="/"]',
    'h3 a[href^="/"]',
    'h4 a[href^="/"]',
    // Repo / list item links
    'li a[href^="/"]',
    'article a[href^="/"]',
  ].join(", "));

  for (const link of candidates) {
    const href = link.getAttribute("href");
    if (!href || seen.has(href)) continue;

    if (href === "#" || href === currentPath) continue;
    if (/^#/.test(href)) continue;

    let fullUrl;
    try {
      fullUrl = new URL(href, window.location.origin);
    } catch {
      continue;
    }
    if (fullUrl.origin !== window.location.origin) continue;

    const path = fullUrl.pathname;
    if (/^\/(settings|login|signup|features|pricing|enterprise|sponsors|about|security|notifications|new|codespaces)\b/.test(path)) continue;
    if (/\.(png|jpg|svg|gif|ico|css|js)$/i.test(path)) continue;

    const title = link.textContent.trim();
    if (!title || title.length < 3 || title.length > 300) continue;

    // Skip user/org profile links (author names, assignees, etc.)
    const hoverType = link.getAttribute("data-hovercard-type");
    if (hoverType === "user" || hoverType === "organization") continue;

    // Heuristic: must look like a content title link
    const isTitle =
      link.classList.contains("Link--primary") ||
      link.classList.contains("markdown-title") ||
      link.classList.contains("js-navigation-open") ||
      link.hasAttribute("data-hovercard-type") ||
      link.closest("h1, h2, h3, h4") ||
      link.closest(".Box-row, [role='row'], .js-issue-row, [id^='issue_'], [data-testid], article");

    if (!isTitle) continue;

    seen.add(href);
    items.push({
      title,
      url: fullUrl.href,
      number: extractNumber(href),
    });
  }

  return items;
}

// ---- Page Detection ----

const PAGE_RULES = [
  { pattern: /\/milestones\/?$/, type: "milestonesList", label: "Milestones" },
  { pattern: /\/milestone\/\d+/, type: "milestone", label: "Milestone" },
  { pattern: /\/pulls\b/, type: "issueOrPr", label: "Pull Requests" },
  { pattern: /\/issues\b/, type: "issueOrPr", label: "Issues" },
  { pattern: /\/projects\b/, type: "projects", label: "Projects" },
  { pattern: /\/discussions\b/, type: "discussions", label: "Discussions" },
  { pattern: /\/releases\b/, type: "releases", label: "Releases" },
  { pattern: /\/tags\b/, type: "tags", label: "Tags" },
  { pattern: /\/branches\b/, type: "branches", label: "Branches" },
  { pattern: /\/commits\b/, type: "commits", label: "Commits" },
  { pattern: /\/actions\b/, type: "actions", label: "Actions" },
  { pattern: /\/packages\b/, type: "packages", label: "Packages" },
  { pattern: /\?tab=repositories/, type: "repositories", label: "Repositories" },
  { pattern: /\/orgs\/[^/]+\/repositories/, type: "repositories", label: "Repositories" },
  { pattern: /\/search/, type: null, label: "Search Results" },
  { pattern: /\/trending/, type: "repositories", label: "Trending" },
  { pattern: /\/explore/, type: "repositories", label: "Explore" },
  { pattern: /\/stars/, type: "repositories", label: "Stars" },
  { pattern: /gist\.github\.com/, type: "gists", label: "Gists" },
];

function detectPage() {
  const path = window.location.pathname;
  const search = window.location.search;
  const full = path + search;

  for (const rule of PAGE_RULES) {
    if (rule.pattern.test(full)) {
      return { type: rule.type, label: rule.label };
    }
  }

  // Any GitHub page — use generic
  return { type: null, label: "Items" };
}

function getContextInfo() {
  const match = window.location.pathname.match(/^\/([^/]+)(?:\/([^/]+))?/);
  if (match) {
    return {
      owner: match[1] || "",
      repo: match[2] || "",
    };
  }
  return { owner: "", repo: "" };
}

function extractItems() {
  const page = detectPage();
  let items = [];

  // Try specific extractor first
  if (page.type && EXTRACTORS[page.type]) {
    items = EXTRACTORS[page.type](document);
  }

  // If specific extractor found nothing, try all extractors
  if (items.length === 0) {
    for (const key of Object.keys(EXTRACTORS)) {
      items = EXTRACTORS[key](document);
      if (items.length > 0) break;
    }
  }

  // Final fallback: generic extraction
  if (items.length === 0) {
    items = genericExtract(document);
  }

  if (items.length === 0) {
    return {
      success: false,
      pageType: null,
      pageLabel: null,
      repo: getContextInfo(),
      items: [],
      error: "No extractable items found on this page.",
    };
  }

  return {
    success: true,
    pageType: page.type || "generic",
    pageLabel: page.label,
    repo: getContextInfo(),
    items,
    url: window.location.href,
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "extract") {
    const result = extractItems();
    sendResponse(result);
  }
  return true;
});

// ============================================================
// Inline Copy Button — Injected Inline on Hover
//
// On mouseover, we inject a small button right AFTER the <a> tag
// in the DOM. It sits inline between the title and any labels:
//   [PR Title] [copy btn] [Test Complete]
//
// On mouseout, the button is removed. No absolute positioning,
// no overlap issues — it flows naturally in the text.
// ============================================================

const COPY_BTN_CLASS = "ghpr-inline-copy";
const TOAST_CLASS = "ghpr-toast";

const COPYABLE_PATTERNS = [
  /\/pull\/\d+/,
  /\/issues\/\d+/,
  /\/discussions\/\d+/,
  /\/releases\/tag\//,
  /\/milestone\//,
  /\/commit\/[a-f0-9]+/,
  /\/tree\/[^/]+$/,
  /\/actions\/runs\/\d+/,
  /\/packages\//,
  /^\/[^/]+\/[^/]+\/?$/,
];

const SKIP_PATTERNS = [
  /^\/(settings|login|signup|features|pricing|enterprise|sponsors|about|security)\b/,
  /^\/(notifications|new|codespaces)\b/,
  /\.(png|jpg|svg|gif|ico|css|js)$/i,
];

function isCopyableLink(anchor) {
  const href = anchor.getAttribute("href");
  if (!href || href === "#" || href.startsWith("#")) return false;

  let url;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;

  const path = url.pathname;
  if (SKIP_PATTERNS.some((p) => p.test(path))) return false;

  const text = anchor.textContent.trim();
  if (!text || text.length < 3 || text.length > 300) return false;

  if (COPYABLE_PATTERNS.some((p) => p.test(path))) return true;

  // Skip user/org profile links (author names, assignees, etc.)
  const hoverType = anchor.getAttribute("data-hovercard-type");
  if (hoverType === "user" || hoverType === "organization") return false;

  if (
    anchor.classList.contains("Link--primary") ||
    anchor.classList.contains("markdown-title") ||
    anchor.classList.contains("js-navigation-open") ||
    anchor.hasAttribute("data-hovercard-type")
  ) {
    return text.length >= 5;
  }

  return false;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function copyRichLink(displayText, url) {
  const html = `<a href="${url}">${escapeHtml(displayText)}</a>`;
  const markdown = `[${displayText}](${url})`;

  const htmlBlob = new Blob([html], { type: "text/html" });
  const textBlob = new Blob([markdown], { type: "text/plain" });

  return navigator.clipboard.write([
    new ClipboardItem({
      "text/html": htmlBlob,
      "text/plain": textBlob,
    }),
  ]);
}

const COPY_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

const CHECK_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function injectStyles() {
  if (document.getElementById("ghpr-inline-styles")) return;

  const style = document.createElement("style");
  style.id = "ghpr-inline-styles";
  style.textContent = `
    .${COPY_BTN_CLASS} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      margin: 0 4px;
      padding: 0;
      border: 1px solid rgba(139,148,158,0.3);
      border-radius: 5px;
      background: #21262d;
      color: #8b949e;
      cursor: pointer;
      vertical-align: middle;
      flex-shrink: 0;
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
      line-height: 1;
    }
    .${COPY_BTN_CLASS}:hover {
      background: #30363d;
      color: #e6edf3;
      border-color: rgba(139,148,158,0.6);
    }
    .${COPY_BTN_CLASS}:active {
      transform: scale(0.92);
    }
    .${COPY_BTN_CLASS}.ghpr-copied {
      background: #0d4429;
      color: #3fb950;
      border-color: rgba(63,185,80,0.5);
    }
    .${COPY_BTN_CLASS} svg {
      width: 13px;
      height: 13px;
      pointer-events: none;
    }

    .${TOAST_CLASS} {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(60px);
      padding: 8px 16px;
      border-radius: 8px;
      background: #0d4429;
      color: #3fb950;
      font-size: 13px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      border: 1px solid rgba(63,185,80,0.3);
      opacity: 0;
      transition: all 250ms ease;
      pointer-events: none;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .${TOAST_CLASS}.ghpr-toast-visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  `;
  document.head.appendChild(style);
}

function showInlineToast(message) {
  let toast = document.querySelector(`.${TOAST_CLASS}`);
  if (!toast) {
    toast = document.createElement("div");
    toast.className = TOAST_CLASS;
    document.body.appendChild(toast);
  }

  const maxLen = 60;
  toast.textContent =
    message.length > maxLen ? message.slice(0, maxLen) + "..." : message;

  toast.classList.remove("ghpr-toast-visible");
  void toast.offsetWidth;
  toast.classList.add("ghpr-toast-visible");

  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(
    () => toast.classList.remove("ghpr-toast-visible"),
    2000
  );
}

// ---- Inline Button Injection ----

let currentAnchor = null;
let currentBtn = null;
let hideTimer = null;

function createInlineButton(anchor) {
  const href = anchor.getAttribute("href");
  const url = new URL(href, window.location.origin).href;
  const title = anchor.textContent.trim();

  const btn = document.createElement("button");
  btn.className = COPY_BTN_CLASS;
  btn.title = "Copy with link";
  btn.innerHTML = COPY_ICON_SVG;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const number = extractNumber(new URL(url).pathname);
    const suffix = number ? ` ${number}` : "";
    const displayText = `${title}${suffix}`;

    copyRichLink(displayText, url).then(() => {
      btn.innerHTML = CHECK_ICON_SVG;
      btn.classList.add("ghpr-copied");
      showInlineToast(`Copied: ${displayText}`);

      setTimeout(() => {
        btn.innerHTML = COPY_ICON_SVG;
        btn.classList.remove("ghpr-copied");
      }, 1500);
    });
  });

  // Keep button alive while hovering it
  btn.addEventListener("mouseenter", () => {
    clearTimeout(hideTimer);
  });

  btn.addEventListener("mouseleave", () => {
    hideTimer = setTimeout(removeButton, 200);
  });

  return btn;
}

function showButton(anchor) {
  // Clean up previous button if different anchor
  if (currentAnchor && currentAnchor !== anchor) {
    removeButton();
  }

  clearTimeout(hideTimer);
  currentAnchor = anchor;

  // Already showing for this anchor
  if (currentBtn && currentBtn.parentNode) return;

  injectStyles();

  currentBtn = createInlineButton(anchor);

  // Insert right after the <a> tag — between title and labels
  anchor.after(currentBtn);
}

function removeButton() {
  if (currentBtn && currentBtn.parentNode) {
    currentBtn.remove();
  }
  currentBtn = null;
  currentAnchor = null;
}

// ---- Event Delegation ----

document.addEventListener(
  "mouseover",
  (e) => {
    const anchor = e.target.closest("a");

    // If hovering the copy button itself, keep it alive
    if (e.target.closest?.(`.${COPY_BTN_CLASS}`)) {
      clearTimeout(hideTimer);
      return;
    }

    if (!anchor) return;

    if (anchor === currentAnchor) {
      clearTimeout(hideTimer);
      return;
    }

    if (isCopyableLink(anchor)) {
      showButton(anchor);
    }
  },
  { passive: true }
);

document.addEventListener(
  "mouseout",
  (e) => {
    const anchor = e.target.closest("a");
    if (!anchor && !e.target.closest?.(`.${COPY_BTN_CLASS}`)) return;

    const related = e.relatedTarget;

    // Don't hide if moving to the copy button or the anchor
    if (related) {
      if (related.classList?.contains(COPY_BTN_CLASS)) return;
      if (related.closest?.(`.${COPY_BTN_CLASS}`)) return;
      if (related === currentAnchor) return;
      if (related.closest?.("a") === currentAnchor) return;
    }

    hideTimer = setTimeout(removeButton, 200);
  },
  { passive: true }
);
