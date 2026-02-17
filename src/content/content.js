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
// Inline Copy Button — Event Delegation Approach
//
// Instead of pre-selecting elements with CSS selectors (fragile),
// we listen for mouseover on the ENTIRE document. When the mouse
// enters any <a> that links to a GitHub resource (PR, issue, repo,
// release, etc.), we show a floating copy button next to it.
//
// This works on ANY GitHub page regardless of DOM structure.
// ============================================================

const COPY_BTN_ID = "ghpr-floating-copy-btn";
const TOAST_CLASS = "ghpr-toast";

// URL patterns that qualify a link as "copyable"
const COPYABLE_PATTERNS = [
  /\/pull\/\d+/,               // PR
  /\/issues\/\d+/,             // Issue
  /\/discussions\/\d+/,        // Discussion
  /\/releases\/tag\//,         // Release
  /\/milestone\//,             // Milestone
  /\/commit\/[a-f0-9]+/,      // Commit
  /\/tree\/[^/]+$/,            // Branch/tag
  /\/actions\/runs\/\d+/,     // Action run
  /\/packages\//,              // Package
  /^\/[^/]+\/[^/]+\/?$/,      // Repository (owner/repo)
];

// Links to SKIP (nav, UI elements, not content)
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

  // Must be same-origin GitHub link
  if (url.origin !== window.location.origin) return false;

  const path = url.pathname;

  // Skip non-content paths
  if (SKIP_PATTERNS.some((p) => p.test(path))) return false;

  // Must have meaningful text (not just an icon or short label)
  const text = anchor.textContent.trim();
  if (!text || text.length < 3 || text.length > 300) return false;

  // Check if it matches a known resource pattern
  if (COPYABLE_PATTERNS.some((p) => p.test(path))) return true;

  // Also allow links that GitHub marks as "primary" or "title"
  if (
    anchor.classList.contains("Link--primary") ||
    anchor.classList.contains("markdown-title") ||
    anchor.classList.contains("js-navigation-open") ||
    anchor.hasAttribute("data-hovercard-type")
  ) {
    // But only if the text looks like a title (not a username or label)
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
    #${COPY_BTN_ID} {
      position: absolute;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      padding: 0;
      border: 1px solid rgba(139,148,158,0.4);
      border-radius: 6px;
      background: #21262d;
      color: #8b949e;
      cursor: pointer;
      z-index: 99999;
      opacity: 0;
      transform: scale(0.85);
      transition: opacity 120ms ease, transform 120ms ease, background 120ms ease, color 120ms ease;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    #${COPY_BTN_ID}.ghpr-visible {
      opacity: 1;
      transform: scale(1);
      pointer-events: auto;
    }
    #${COPY_BTN_ID}:hover {
      background: #30363d;
      color: #e6edf3;
      border-color: rgba(139,148,158,0.6);
    }
    #${COPY_BTN_ID}:active {
      transform: scale(0.92) !important;
    }
    #${COPY_BTN_ID}.ghpr-copied {
      background: #0d4429;
      color: #3fb950;
      border-color: rgba(63,185,80,0.5);
    }
    #${COPY_BTN_ID} svg {
      width: 14px;
      height: 14px;
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

// ---- Floating Copy Button (singleton) ----

let floatingBtn = null;
let currentAnchor = null;
let hideTimer = null;

function getOrCreateButton() {
  if (floatingBtn) return floatingBtn;

  injectStyles();

  floatingBtn = document.createElement("button");
  floatingBtn.id = COPY_BTN_ID;
  floatingBtn.innerHTML = COPY_ICON_SVG;
  floatingBtn.title = "Copy title with link";
  document.body.appendChild(floatingBtn);

  floatingBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentAnchor) return;

    const href = currentAnchor.getAttribute("href");
    const url = new URL(href, window.location.origin).href;
    const title = currentAnchor.textContent.trim();
    const number = extractNumber(new URL(url).pathname);
    const suffix = number ? ` ${number}` : "";
    const displayText = `${title}${suffix}`;

    copyRichLink(displayText, url).then(() => {
      floatingBtn.innerHTML = CHECK_ICON_SVG;
      floatingBtn.classList.add("ghpr-copied");
      showInlineToast(`Copied: ${displayText}`);

      setTimeout(() => {
        floatingBtn.innerHTML = COPY_ICON_SVG;
        floatingBtn.classList.remove("ghpr-copied");
      }, 1500);
    });
  });

  // Keep button visible when hovering the button itself
  floatingBtn.addEventListener("mouseenter", () => {
    clearTimeout(hideTimer);
  });

  floatingBtn.addEventListener("mouseleave", () => {
    hideTimer = setTimeout(hideButton, 150);
  });

  return floatingBtn;
}

function showButton(anchor) {
  clearTimeout(hideTimer);
  currentAnchor = anchor;

  const btn = getOrCreateButton();
  const rect = anchor.getBoundingClientRect();

  // Position to the LEFT of the link to avoid overlapping labels/badges
  btn.style.top = `${window.scrollY + rect.top + (rect.height - 26) / 2}px`;
  btn.style.left = `${window.scrollX + rect.left - 32}px`;

  // If too close to the left edge, fallback to right side with extra offset
  if (rect.left - 32 < 8) {
    btn.style.left = `${window.scrollX + rect.right + 8}px`;
  }

  btn.classList.add("ghpr-visible");
}

function hideButton() {
  if (floatingBtn) {
    floatingBtn.classList.remove("ghpr-visible");
  }
  currentAnchor = null;
}

// ---- Event Delegation ----

document.addEventListener(
  "mouseover",
  (e) => {
    // Walk up from the target to find the nearest <a>
    const anchor = e.target.closest("a");
    if (!anchor) return;

    // Is this the same link we're already showing for?
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
    if (!anchor) return;

    // Don't hide if moving to the copy button
    const related = e.relatedTarget;
    if (related && (related.id === COPY_BTN_ID || related.closest?.(`#${COPY_BTN_ID}`))) {
      return;
    }

    hideTimer = setTimeout(hideButton, 150);
  },
  { passive: true }
);
