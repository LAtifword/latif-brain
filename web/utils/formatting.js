/**
 * Text Formatting Utilities
 * Helper functions for text processing and display
 */

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function truncateText(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function formatTokenCount(count) {
  if (count < 1000) return count.toString();
  if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
  return (count / 1000000).toFixed(1) + 'M';
}

export function sanitizeText(text) {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/&(?!(?:[a-zA-Z]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

export function extractCodeBlocks(text) {
  const blocks = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  return blocks;
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function highlightText(text, highlight) {
  if (!highlight) return escapeHtml(text);

  const escaped = escapeHtml(text);
  const regex = new RegExp(`(${escapeHtml(highlight)})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

export function truncateMiddle(text, maxLength = 50) {
  if (text.length <= maxLength) return text;
  const start = Math.floor(maxLength / 2);
  const end = text.length - Math.floor(maxLength / 2);
  return text.substring(0, start) + '...' + text.substring(end);
}

export function generateChatPreview(messages, maxChars = 80) {
  if (!messages || messages.length === 0) return 'No messages';

  const lastMessage = messages[messages.length - 1];
  return truncateText(lastMessage.content, maxChars);
}

export function generateChatTitle(messages) {
  if (!messages || messages.length === 0) return 'New Chat';

  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) return 'New Chat';

  const firstUserMsg = userMessages[0].content;
  return truncateText(firstUserMsg, 50);
}

export function parseMarkdownLinks(text) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [];
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
      index: match.index
    });
  }

  return links;
}

export function stripMarkdown(text) {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/~~(.+?)~~/g, '$1');
}

export function dedentText(text) {
  const lines = text.split('\n');
  const minIndent = lines
    .filter(line => line.trim())
    .reduce((min, line) => Math.min(min, line.search(/\S/)), Infinity);

  if (minIndent === Infinity) return text;

  return lines
    .map(line => line.slice(minIndent))
    .join('\n');
}
