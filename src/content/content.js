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

  // Find prominent links that look like list-item titles.
  // Strategy: look for links inside list containers that point
  // to GitHub internal pages and are styled as primary/title links.
  const candidates = doc.querySelectorAll([
    // Primary-styled links (GitHub's title class)
    'a.Link--primary',
    // Links inside common list containers
    '.Box-row a[href^="/"]',
    'li a[href^="/"]',
    '[role="row"] a[href^="/"]',
    // Hovercard links (repos, users, etc.)
    'a[data-hovercard-type]',
    // Links inside h3/h4 (common title pattern)
    'h3 a[href^="/"]',
    'h4 a[href^="/"]',
  ].join(", "));

  for (const link of candidates) {
    const href = link.getAttribute("href");
    if (!href || seen.has(href)) continue;

    // Skip navigation, pagination, and anchor links
    if (href === "#" || href === currentPath) continue;
    if (/^#/.test(href)) continue;

    // Must be a GitHub internal link
    const fullUrl = new URL(href, window.location.origin);
    if (fullUrl.origin !== window.location.origin) continue;

    // Skip common non-content links
    const path = fullUrl.pathname;
    if (/^\/(settings|login|signup|features|pricing|enterprise|sponsors)\b/.test(path)) continue;
    if (/\.(png|jpg|svg|gif|ico)$/i.test(path)) continue;

    const title = link.textContent.trim();
    if (!title || title.length < 2 || title.length > 300) continue;

    // Heuristic: prefer links that look like content titles
    // (inside a heading, has primary class, or has a hovercard)
    const isTitle =
      link.classList.contains("Link--primary") ||
      link.closest("h1, h2, h3, h4") ||
      link.hasAttribute("data-hovercard-type") ||
      link.closest(".Box-row, [role='row'], li.Box-row, .js-issue-row, [data-testid]");

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

  // Fall back to generic if specific found nothing
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
// Inline Copy Button — appears on hover, works on ANY list item
// ============================================================

const COPY_BTN_CLASS = "ghpr-copy-btn";
const TOAST_CLASS = "ghpr-toast";

// Selectors for title links where we attach the inline copy button.
// Covers all known GitHub list patterns + a broad fallback.
const INLINE_SELECTORS = [
  // PRs & Issues — markdown-title (used on milestone detail, older pages)
  '[id^="issue_"] a.markdown-title',
  '[id^="issue_"] a.js-navigation-open',
  '.js-issue-row a.markdown-title',
  '.js-issue-row a.js-navigation-open',
  'a.markdown-title[href*="/pull/"]',
  'a.markdown-title[href*="/issues/"]',
  'a.js-navigation-open[href*="/pull/"]',
  'a.js-navigation-open[href*="/issues/"]',
  // PRs & Issues — Link--primary (newer pages)
  '[id^="issue_"] .Link--primary',
  '.js-issue-row .Link--primary',
  '[data-testid="issue-row"] a[data-testid="issue-title-link"]',
  '[data-testid="list-row"] a[data-testid="issue-title-link"]',
  '[data-testid="list-row"] a[data-testid="pull-request-title-link"]',
  '.js-issue-row a[data-hovercard-type="pull_request"]',
  '.js-issue-row a[data-hovercard-type="issue"]',
  '.listRow a.Link--primary',
  'div[data-id] a.Link--primary',
  // Repos
  '[itemprop="name codeRepository"] a',
  'a[itemprop="name codeRepository"]',
  'h3 a[data-hovercard-type="repository"]',
  '#user-repositories-list h3 a',
  '.org-repos h3 a',
  'article h3 a',
  // Releases & Tags
  '.release .Link--primary',
  '[data-testid="release-card"] a.Link--primary',
  'a[href*="/releases/tag/"]',
  // Discussions
  'a[data-hovercard-type="discussion"]',
  // Milestones
  "a.Link--primary[href*='/milestone/']",
  // Broad fallback: primary links inside list rows
  '.Box-row a.Link--primary',
  '.Box-row a.markdown-title',
  '.Box-row h3 a',
  '.Box-row h4 a',
  '[role="row"] a.Link--primary',
];

function injectStyles() {
  if (document.getElementById("ghpr-inline-styles")) return;

  const style = document.createElement("style");
  style.id = "ghpr-inline-styles";
  style.textContent = `
    .${COPY_BTN_CLASS} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      margin-left: 6px;
      padding: 0;
      border: 1px solid rgba(139,148,158,0.3);
      border-radius: 6px;
      background: #21262d;
      color: #8b949e;
      cursor: pointer;
      opacity: 0;
      transform: scale(0.85);
      transition: opacity 150ms ease, transform 150ms ease, background 150ms ease, color 150ms ease;
      vertical-align: middle;
      position: relative;
      flex-shrink: 0;
    }
    .${COPY_BTN_CLASS}:hover {
      background: #30363d;
      color: #e6edf3;
      border-color: rgba(139,148,158,0.5);
    }
    .${COPY_BTN_CLASS}:active {
      transform: scale(0.9) !important;
    }
    .${COPY_BTN_CLASS}.ghpr-copied {
      background: #0d4429;
      color: #3fb950;
      border-color: rgba(63,185,80,0.4);
    }
    .${COPY_BTN_CLASS} svg {
      width: 14px;
      height: 14px;
      pointer-events: none;
    }

    /* Show button on hover — covers all list row patterns */
    [id^="issue_"]:hover .${COPY_BTN_CLASS},
    .js-issue-row:hover .${COPY_BTN_CLASS},
    [data-testid="issue-row"]:hover .${COPY_BTN_CLASS},
    [data-testid="list-row"]:hover .${COPY_BTN_CLASS},
    .js-navigation-item:hover .${COPY_BTN_CLASS},
    .listRow:hover .${COPY_BTN_CLASS},
    div[data-id]:hover .${COPY_BTN_CLASS},
    .Box-row:hover .${COPY_BTN_CLASS},
    [role="row"]:hover .${COPY_BTN_CLASS},
    li:hover > .ghpr-title-wrap .${COPY_BTN_CLASS},
    article:hover .${COPY_BTN_CLASS},
    .release:hover .${COPY_BTN_CLASS},
    [data-testid="release-card"]:hover .${COPY_BTN_CLASS} {
      opacity: 1;
      transform: scale(1);
    }

    /* Fallback: show on direct title-area hover */
    .ghpr-title-wrap:hover .${COPY_BTN_CLASS} {
      opacity: 1;
      transform: scale(1);
    }

    .ghpr-title-wrap {
      display: inline-flex;
      align-items: center;
    }

    /* Toast notification */
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

const COPY_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
</svg>`;

const CHECK_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="20 6 9 17 4 12"/>
</svg>`;

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

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createCopyButton(titleText, url) {
  const btn = document.createElement("button");
  btn.className = COPY_BTN_CLASS;
  btn.title = "Copy title with link";
  btn.innerHTML = COPY_ICON_SVG;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const number = extractNumber(new URL(url).pathname);
    const suffix = number ? ` ${number}` : "";
    const displayText = `${titleText}${suffix}`;

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

  return btn;
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

function attachCopyButtons() {
  injectStyles();

  const processed = new WeakSet();

  for (const selector of INLINE_SELECTORS) {
    for (const link of document.querySelectorAll(selector)) {
      if (processed.has(link)) continue;

      const href = link.getAttribute("href");
      if (!href || href === "#") continue;

      // Must be a GitHub internal link
      try {
        const fullUrl = new URL(href, window.location.origin);
        if (fullUrl.origin !== window.location.origin) continue;
      } catch {
        continue;
      }

      processed.add(link);

      // Skip if already wrapped
      if (link.parentElement?.classList.contains("ghpr-title-wrap")) continue;

      const title = link.textContent.trim();
      if (!title || title.length < 2) continue;

      const url = new URL(href, window.location.origin).href;

      const wrapper = document.createElement("span");
      wrapper.className = "ghpr-title-wrap";
      link.parentNode.insertBefore(wrapper, link);
      wrapper.appendChild(link);
      wrapper.appendChild(createCopyButton(title, url));
    }
  }
}

// Run on page load
attachCopyButtons();

// Re-run when GitHub does SPA navigation (turbo/pjax)
const observer = new MutationObserver(() => {
  clearTimeout(observer._timer);
  observer._timer = setTimeout(attachCopyButtons, 300);
});

observer.observe(document.body, { childList: true, subtree: true });
