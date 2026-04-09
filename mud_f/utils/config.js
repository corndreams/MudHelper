export function getBaseURL() {
  try {
    const saved = uni.getStorageSync('BASE_URL');
    if (saved && typeof saved === 'string') {
      return saved;
    }
  } catch (e) {}
  //return "http://localhost:3001/";
  return "http://1.12.240.180:3001/";
}

export function setBaseURL(url) {
  if (url && typeof url === 'string') {
    uni.setStorageSync('BASE_URL', url.replace(/\/+$/, ''));
  }
}

export function getWSURL() {
  const base = getBaseURL();
  try {
    const u = new URL(base);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = '/ws';
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch (e) {
    return base.replace(/^http/, 'ws') + '/ws';
  }
}
