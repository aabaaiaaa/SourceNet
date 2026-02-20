/* global __BUILD_SHA__, __BUILD_DATE__ */

const sha = typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'dev';
const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : null;

export const BUILD_SHA = sha === 'dev' ? 'dev' : sha.slice(0, 7);
export const BUILD_DATE = buildDate;

export function getTimeAgo(isoDate) {
  if (!isoDate) return '';
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getBuildString() {
  if (BUILD_SHA === 'dev') return 'dev build';
  const dateStr = BUILD_DATE ? new Date(BUILD_DATE).toLocaleDateString() : '';
  const ago = getTimeAgo(BUILD_DATE);
  return `${BUILD_SHA} - ${dateStr} (${ago})`;
}
