const TOKEN_KEY = 'AUTH_TOKEN';

export function getToken() {
  try {
    return uni.getStorageSync(TOKEN_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setToken(token) {
  if (token) {
    uni.setStorageSync(TOKEN_KEY, token);
  }
}

export function clearToken() {
  uni.removeStorageSync(TOKEN_KEY);
}
