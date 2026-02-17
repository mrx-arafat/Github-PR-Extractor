"use strict";

/**
 * GitHub Extractor — Background Service Worker
 *
 * Works on any GitHub page — the extension is universal.
 */

function isGitHub(url) {
  return /^https:\/\/github\.com\//.test(url);
}

function updateBadge(tabId, url) {
  if (isGitHub(url)) {
    chrome.action.setTitle({
      title: "GitHub Extractor — Click to extract items",
      tabId,
    });
  } else {
    chrome.action.setTitle({
      title: "GitHub Extractor — Navigate to github.com",
      tabId,
    });
  }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) updateBadge(tabId, tab.url);
  } catch {
    // tab may have been closed
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    updateBadge(tabId, changeInfo.url);
  }
});
