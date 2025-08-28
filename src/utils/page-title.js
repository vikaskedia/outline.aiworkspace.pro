export function setOutlineTitle(focusedText, workspaceName, activeTabName) {
  // If an explicit active tab name is provided prefer the new multi-part title
  if (activeTabName) {
    // Example: {active_tab_name} < outline < {workspace_name} < AI Workspace
    document.title = `${activeTabName} < ${workspaceName} < AI Workspace`;
    return;
  }

  // Backward-compatible behavior: if no active tab name, use focused text when available
  const title = focusedText
    ? `${focusedText} - ${workspaceName}`
    : `${workspaceName} - Outline`;
  document.title = title;
}

export function getCleanText(text) {
  if (!text) return ''
  // Remove HTML tags and clean up text for title display
  return text.replace(/<[^>]*>/g, '').trim()
}
