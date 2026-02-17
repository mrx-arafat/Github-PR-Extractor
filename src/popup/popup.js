"use strict";

/**
 * GitHub PR Extractor — Popup Script
 *
 * Handles UI: extraction trigger, item rendering, filtering,
 * selection, and copy in multiple formats.
 */

// ---- State ----
let allItems = [];
let selectedIds = new Set();
let activeFormat = "markdown";
let pageData = null;

// ---- DOM refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const meta = $("#meta");
const controls = $("#controls");
const filterBar = $("#filterBar");
const filterInput = $("#filterInput");
const filterCount = $("#filterCount");
const itemList = $("#itemList");
const loadingState = $("#loadingState");
const emptyState = $("#emptyState");
const emptyMessage = $("#emptyMessage");
const footer = $("#footer");
const totalCount = $("#totalCount");
const selectAllLink = $("#selectAll");
const copyBtn = $("#copyBtn");
const copyLabel = $("#copyLabel");
const includeNumbers = $("#includeNumbers");

// ---- Init ----
document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  await extractFromPage();
}

function bindEvents() {
  // Format buttons
  for (const btn of $$("[data-format]")) {
    btn.addEventListener("click", () => {
      activeFormat = btn.dataset.format;
      for (const b of $$("[data-format]")) b.classList.remove("btn--active");
      btn.classList.add("btn--active");
    });
  }

  // Copy
  copyBtn.addEventListener("click", handleCopy);

  // Filter
  filterInput.addEventListener("input", handleFilter);

  // Select all toggle
  selectAllLink.addEventListener("click", (e) => {
    e.preventDefault();
    const visibleItems = getVisibleItems();
    const allSelected = visibleItems.every((item) => selectedIds.has(item.url));

    for (const item of visibleItems) {
      if (allSelected) {
        selectedIds.delete(item.url);
      } else {
        selectedIds.add(item.url);
      }
    }

    updateCheckboxes();
    updateFooter();
    updateSelectAllLabel();
  });

  // Include numbers toggle
  includeNumbers.addEventListener("change", () => {
    // preference only affects copy output, no re-render needed
  });
}

// ---- Extraction ----
async function extractFromPage() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id || !tab.url?.startsWith("https://github.com")) {
      showEmpty("Navigate to a GitHub page to extract items.");
      return;
    }

    // Inject content script if needed, then message it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/content.js"],
      });
    } catch {
      // content script may already be injected — that's fine
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "extract",
    });

    if (!response || !response.success || response.items.length === 0) {
      showEmpty(
        response?.error || "No items found. Try a PRs, Issues, or Milestones page."
      );
      return;
    }

    pageData = response;
    allItems = response.items;

    // Select all by default
    for (const item of allItems) {
      selectedIds.add(item.url);
    }

    renderUI();
  } catch (err) {
    showEmpty("Could not connect to this page. Try refreshing.");
    console.error("PR Extractor:", err);
  }
}

// ---- Render ----
function renderUI() {
  loadingState.hidden = true;
  emptyState.hidden = true;

  // Meta
  meta.innerHTML = `
    <span class="header__badge">${pageData.pageLabel}</span>
    <span>${pageData.repo.owner}/${pageData.repo.repo}</span>
  `;

  // Show controls
  controls.hidden = false;
  filterBar.hidden = false;
  footer.hidden = false;

  renderItems(allItems);
  updateFooter();
}

function renderItems(items) {
  // Remove old items (keep states)
  for (const el of [...itemList.children]) {
    if (!el.classList.contains("state")) el.remove();
  }

  if (items.length === 0) {
    emptyState.hidden = false;
    emptyMessage.textContent = "No items match your filter.";
    return;
  }

  emptyState.hidden = true;

  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "item";
    row.dataset.url = item.url;

    const typeBadge = getTypeBadge(item.url);
    const numberHtml = item.number
      ? `<span class="item__number">${item.number}</span>`
      : "";

    row.innerHTML = `
      <input type="checkbox" class="item__checkbox"
        ${selectedIds.has(item.url) ? "checked" : ""}
        data-url="${escapeAttr(item.url)}" />
      <div class="item__body">
        <a class="item__title" href="${escapeAttr(item.url)}"
          target="_blank" rel="noopener noreferrer"
          title="${escapeAttr(item.title)}">${escapeHtml(item.title)}</a>
        <div class="item__meta">
          ${numberHtml}
          ${typeBadge}
        </div>
      </div>
    `;

    const checkbox = row.querySelector(".item__checkbox");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedIds.add(item.url);
      } else {
        selectedIds.delete(item.url);
      }
      updateFooter();
      updateSelectAllLabel();
    });

    fragment.appendChild(row);
  }

  itemList.appendChild(fragment);
}

function getTypeBadge(url) {
  if (url.includes("/pull/")) {
    return '<span class="item__type-badge item__type-badge--pr">PR</span>';
  }
  if (url.includes("/issues/")) {
    return '<span class="item__type-badge item__type-badge--issue">Issue</span>';
  }
  if (url.includes("/milestone/")) {
    return '<span class="item__type-badge item__type-badge--milestone">Milestone</span>';
  }
  return "";
}

// ---- Filter ----
function handleFilter() {
  const query = filterInput.value.toLowerCase().trim();

  if (!query) {
    renderItems(allItems);
    filterCount.textContent = "";
    updateFooter();
    return;
  }

  const filtered = allItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query) ||
      (item.number && item.number.includes(query))
  );

  renderItems(filtered);
  filterCount.textContent = `${filtered.length}/${allItems.length}`;
  highlightMatches(query);
  updateFooter();
}

function highlightMatches(query) {
  for (const titleEl of itemList.querySelectorAll(".item__title")) {
    const text = titleEl.textContent;
    const idx = text.toLowerCase().indexOf(query);
    if (idx >= 0) {
      titleEl.innerHTML =
        escapeHtml(text.slice(0, idx)) +
        `<mark>${escapeHtml(text.slice(idx, idx + query.length))}</mark>` +
        escapeHtml(text.slice(idx + query.length));
    }
  }
}

// ---- Selection ----
function getVisibleItems() {
  const query = filterInput.value.toLowerCase().trim();
  if (!query) return allItems;
  return allItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query) ||
      (item.number && item.number.includes(query))
  );
}

function getSelectedItems() {
  return allItems.filter((item) => selectedIds.has(item.url));
}

function updateCheckboxes() {
  for (const cb of itemList.querySelectorAll(".item__checkbox")) {
    cb.checked = selectedIds.has(cb.dataset.url);
  }
}

function updateFooter() {
  const selected = selectedIds.size;
  totalCount.textContent = `${selected} of ${allItems.length} selected`;
  copyLabel.textContent = selected === 0 ? "Copy All" : `Copy (${selected})`;
  updateSelectAllLabel();
}

function updateSelectAllLabel() {
  const visibleItems = getVisibleItems();
  const allSelected = visibleItems.every((item) => selectedIds.has(item.url));
  selectAllLink.textContent = allSelected ? "Deselect All" : "Select All";
}

// ---- Copy ----

/**
 * Writes both rich text (text/html) and plain text to the clipboard.
 * - Slack, Notion, Google Docs → read the HTML → render clickable links
 * - Plain text editors → get the Markdown/plain fallback
 */
function copyRichText(html, plainText) {
  const htmlBlob = new Blob([html], { type: "text/html" });
  const textBlob = new Blob([plainText], { type: "text/plain" });

  return navigator.clipboard.write([
    new ClipboardItem({
      "text/html": htmlBlob,
      "text/plain": textBlob,
    }),
  ]);
}

function handleCopy() {
  let items = getSelectedItems();

  // If nothing selected, copy all
  if (items.length === 0) {
    items = allItems;
  }

  const withNumbers = includeNumbers.checked;
  const format = activeFormat;
  const plainText = formatPlainText(items, format, withNumbers);
  const html = formatHtml(items, withNumbers);

  // For CSV and plain formats, just write plain text (no rich text needed)
  if (format === "csv" || format === "plain") {
    navigator.clipboard.writeText(plainText).then(() => {
      showCopySuccess();
      showToast(`Copied ${items.length} items as ${format}`);
    });
    return;
  }

  // For Markdown and HTML formats, write rich text so Slack/Notion get clickable links
  copyRichText(html, plainText).then(() => {
    showCopySuccess();
    showToast(`Copied ${items.length} items as rich text`);
  });
}

/**
 * Generate HTML with clickable links — this is what Slack/Notion/Docs read.
 */
function formatHtml(items, withNumbers) {
  if (items.length === 1) {
    const item = items[0];
    const suffix = withNumbers && item.number ? ` ${item.number}` : "";
    return `<a href="${escapeAttr(item.url)}">${escapeHtml(item.title + suffix)}</a>`;
  }

  const listItems = items
    .map((item) => {
      const suffix = withNumbers && item.number ? ` ${item.number}` : "";
      return `<li><a href="${escapeAttr(item.url)}">${escapeHtml(item.title + suffix)}</a></li>`;
    })
    .join("");

  return `<ul>${listItems}</ul>`;
}

/**
 * Generate plain text fallback for editors that don't support HTML paste.
 */
function formatPlainText(items, format, withNumbers) {
  switch (format) {
    case "markdown":
      return items
        .map((item) => {
          const suffix = withNumbers && item.number ? ` ${item.number}` : "";
          return `- [${item.title}${suffix}](${item.url})`;
        })
        .join("\n");

    case "plain":
      return items
        .map((item) => {
          const suffix = withNumbers && item.number ? ` ${item.number}` : "";
          return `${item.title}${suffix} — ${item.url}`;
        })
        .join("\n");

    case "html":
      return items
        .map((item) => {
          const suffix = withNumbers && item.number ? ` ${item.number}` : "";
          return `<a href="${escapeAttr(item.url)}">${escapeHtml(item.title + suffix)}</a>`;
        })
        .join("\n");

    case "csv": {
      const header = "Title,Number,URL";
      const rows = items.map((item) => {
        const num = item.number || "";
        const title = `"${item.title.replace(/"/g, '""')}"`;
        return `${title},${num},${item.url}`;
      });
      return [header, ...rows].join("\n");
    }

    default:
      return "";
  }
}

// ---- Feedback ----
function showCopySuccess() {
  copyBtn.classList.add("btn--success");
  const origLabel = copyLabel.textContent;
  copyLabel.textContent = "Copied!";

  setTimeout(() => {
    copyBtn.classList.remove("btn--success");
    copyLabel.textContent = origLabel;
  }, 1500);
}

function showToast(message) {
  let toast = $(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("toast--visible");

  setTimeout(() => toast.classList.remove("toast--visible"), 2000);
}

function showEmpty(message) {
  loadingState.hidden = true;
  emptyState.hidden = false;
  emptyMessage.textContent = message;
}

// ---- Utils ----
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
