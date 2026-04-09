import { getBaseURL } from "./config.js";
import { getToken, clearToken } from "./auth.js";

export function request({ url, method = "GET", data = {}, headers = {} }) {
  const base = getBaseURL();
  const token = getToken();
  const auth = token ? { Authorization: "Bearer " + token } : {};
  return new Promise((resolve, reject) => {
    uni.request({
      url: base.replace(/\/+$/, "") + url,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        ...auth,
        ...headers,
      },
      timeout: 15000,
      success(res) {
        const { statusCode, data } = res;
        if (statusCode === 401) {
          clearToken();
          uni.showToast({ title: "登录已过期", icon: "none" });
          setTimeout(() => {
            uni.reLaunch({ url: "/pages/auth/login" });
          }, 800);
          reject(new Error("Unauthorized"));
          return;
        }
        resolve(data);
      },
      fail(err) {
        uni.showToast({ title: "网络异常", icon: "none" });
        reject(err);
      },
    });
  });
}

export const api = {
  sendCode(email) {
    return request({ url: "/auth/send-code", method: "POST", data: { email } });
  },
  register(email, username, password) {
    return request({
      url: "/auth/register",
      method: "POST",
      data: { email, username, password },
    });
  },
  login(email, code) {
    return request({
      url: "/auth/login",
      method: "POST",
      data: { email, code },
    });
  },
  loginPassword(account, password) {
    return request({
      url: "/auth/login-password",
      method: "POST",
      data: { account, password },
    });
  },
  me() {
    return request({ url: "/auth/me" });
  },
  getConfig() {
    return request({ url: "/mud/config" });
  },
  saveConfig(payload) {
    return request({ url: "/mud/config", method: "POST", data: payload });
  },
  getServers() {
    return request({ url: "/mud/servers" });
  },
  getServerConfig(serverId) {
    return request({
      url: `/mud/server-config?serverId=${encodeURIComponent(serverId)}`,
    });
  },
  saveServerConfig(payload) {
    return request({
      url: "/mud/server-config",
      method: "POST",
      data: payload,
    });
  },
  startTask(payload) {
    return request({ url: "/mud/start", method: "POST", data: payload });
  },
  stopTask(taskId) {
    return request({ url: "/mud/stop", method: "POST", data: { taskId } });
  },
  getLog(taskId) {
    return request({ url: `/mud/log?taskId=${encodeURIComponent(taskId)}` });
  },
  getGroups() {
    return request({ url: "/mud/groups" });
  },
  saveGroups(groups) {
    return request({ url: "/mud/groups", method: "POST", data: { groups } });
  },
};
