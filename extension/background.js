// Clicking the extension's icon opens the import page in its own tab (a long export is not cut off like it would be in a
// popup that closes). The page learns which tab it came from, to look for Kahoot quizzes on it.
chrome.action.onClicked.addListener((tab) => {
  const from = tab && tab.id !== undefined ? `?from=${tab.id}` : '';
  chrome.tabs.create({ url: chrome.runtime.getURL('app.html') + from });
});
