<template>
  <scroll-view class="wrap" scroll-y="true">
    <view class="topbar">
      <text class="title">主控</text>
    </view>

    <view class="card">
      <text class="section">连接配置</text>
      <text class="sub">用于游戏服务器登录，与 App 登录无关</text>
      <view class="field" v-if="servers.length">
        <text class="label">选择服务器</text>
        <picker
          mode="selector"
          :range="servers"
          range-key="name"
          :value="serverIndex"
          @change="onServerChange"
        >
          <view class="picker">{{ currentServerName }}</view>
        </picker>
      </view>
      <view class="field"
        ><text class="label">游戏账号</text
        ><input class="input" v-model="form.account" placeholder="account"
      /></view>
      <view class="field"
        ><text class="label">密码</text
        ><input
          class="input"
          password
          v-model="form.password"
          placeholder="password"
      /></view>
      <view class="field"
        ><text class="label">绑定邮箱</text
        ><input
          class="input"
          v-model="form.email"
          placeholder="bind@example.com"
      /></view>
    </view>

    <view class="card">
      <text class="section">指令序列</text>
      <textarea
        class="textarea"
        v-model="form.commands"
        placeholder="每行一条，例如：look|0.5"
        :maxlength="-1"
      />
      <view class="row">
        <view class="col">
          <text class="label small">默认间隔(s)</text>
          <input
            class="input"
            type="digit"
            v-model.number="form.interval"
            placeholder="0.5"
          />
        </view>
        <view class="col">
          <text class="label small">循环次数(0无限)</text>
          <input
            class="input"
            type="number"
            v-model.number="form.loopCount"
            placeholder="0"
          />
        </view>
      </view>
      <view class="row">
        <view class="col">
          <text class="label small">响应超时(ms)</text>
          <input
            class="input"
            type="number"
            v-model.number="form.waitTimeoutMs"
            placeholder="500"
          />
        </view>
      </view>
      <view class="row btns">
        <button class="btn" @tap="onSave" :disabled="loading">保存配置</button>
        <button
          class="btn primary"
          @tap="onStart"
          :disabled="!canStart || loading || running"
        >
          启动
        </button>
        <button
          class="btn danger"
          v-if="running"
          @tap="onStop"
          :disabled="loading"
        >
          停止
        </button>
      </view>
    </view>

    <view class="card">
      <view class="row between">
        <text class="section">实时日志</text>
        <view class="badge">
          <view class="dot" :class="running ? 'ok' : 'off'"></view>
          <text>{{ statusText }}</text>
        </view>
      </view>
      <view v-if="timerText" class="timer">{{ timerText }}</view>
      <scroll-view class="log" scroll-y="true" :scroll-top="scrollTop">
        <text selectable>{{ displayLog }}</text>
      </scroll-view>
      <view class="row btns">
        <button class="btn" @tap="clearLog">清空</button>
      </view>
    </view>
  </scroll-view>
</template>

<script>
import { api } from "../../utils/http.js";
import { LogSocket } from "../../utils/ws.js";
export default {
  data() {
    return {
      loading: false,
      running: false,
      taskId: "",
      servers: [],
      serverId: null,
      serverIndex: 0,
      useServerFlow: false,
      form: {
        account: "",
        password: "",
        email: "",
        commands: "",
        interval: 0.5,
        loopCount: 0,
        waitTimeoutMs: 500,
      },
      logText: "",
      timerText: "",
      pollTimer: null,
      sock: null,
      baselineLen: 0,
      lastRawLen: 0,
      scrollTop: 0,
    };
  },
  computed: {
    canStart() {
      return this.form.account && this.form.password;
    },
    statusText() {
      return this.running ? "执行中" : "未运行";
    },
    currentServerName() {
      return this.servers[this.serverIndex]
        ? this.servers[this.serverIndex].name
        : "请选择";
    },
    displayLog() {
      return this.logText;
    },
  },
  methods: {
    goGroups() {
      uni.navigateTo({ url: "/pages/groups/index" });
    },
    goProfile() {
      uni.navigateTo({ url: "/pages/profile/index" });
    },
    loadConfig() {
      this.loadServers();
    },
    loadServers() {
      api
        .getServers()
        .then((res) => {
          if (
            res &&
            res.success &&
            Array.isArray(res.servers) &&
            res.servers.length
          ) {
            this.servers = res.servers;
            this.serverIndex = 0;
            this.serverId = res.servers[0].id;
            this.useServerFlow = true;
            this.loadServerConfig();
          } else {
            this.useServerFlow = false;
            this.loadLegacyConfig();
          }
        })
        .catch(() => {
          this.useServerFlow = false;
          this.loadLegacyConfig();
        });
    },
    onServerChange(e) {
      const i = Number(e.detail.value || 0);
      if (this.servers[i]) {
        this.serverIndex = i;
        this.serverId = this.servers[i].id;
        this.loadServerConfig();
      }
    },
    loadServerConfig() {
      if (!this.serverId) return;
      api.getServerConfig(this.serverId).then((res) => {
        if (res && res.success && res.data) {
          const d = res.data;
          this.form.account = d.account || "";
          this.form.email = d.bind_email || "";
          this.form.commands = d.commands || "";
          this.form.interval = d.interval_sec != null ? d.interval_sec : 0.5;
          this.form.loopCount = d.loop_count != null ? d.loop_count : 0;
          this.form.waitTimeoutMs =
            d.wait_timeout_ms != null ? d.wait_timeout_ms : 500;
        }
      });
    },
    loadLegacyConfig() {
      api.getConfig().then((res) => {
        if (res && res.success && res.data) {
          const d = res.data;
          this.form.account = d.account || "";
          this.form.password = d.passwd || "";
          this.form.email = d.bind_email || "";
          this.form.commands = d.commands || "";
          this.form.interval = d.interval_sec != null ? d.interval_sec : 0.5;
          this.form.loopCount = d.loop_count != null ? d.loop_count : 0;
          this.form.waitTimeoutMs = 500;
        }
      });
    },
    onSave() {
      this.loading = true;
      const savePromise = this.useServerFlow
        ? api.saveServerConfig({
            serverId: this.serverId,
            account: this.form.account,
            bind_email: this.form.email,
            commands: this.form.commands,
            interval_sec: this.form.interval,
            loop_count: this.form.loopCount,
            wait_timeout_ms: this.form.waitTimeoutMs,
          })
        : api.saveConfig({
            account: this.form.account,
            passwd: this.form.password,
            bind_email: this.form.email,
            commands: this.form.commands,
            interval_sec: this.form.interval,
            loop_count: this.form.loopCount,
          });
      savePromise
        .then((res) => {
          this.loading = false;
          if (res && res.success) {
            uni.showToast({ title: "已保存", icon: "none" });
          } else {
            uni.showToast({ title: "保存失败", icon: "none" });
          }
        })
        .catch(() => {
          this.loading = false;
        });
    },
    onStart() {
      if (!this.canStart) {
        uni.showToast({ title: "请填写账号与密码", icon: "none" });
        return;
      }
      this.loading = true;
      const payload = {
        account: this.form.account,
        password: this.form.password,
        email: this.form.email,
        commands: this.form.commands,
        interval: this.form.interval,
        loopCount: this.form.loopCount,
      };
      if (this.useServerFlow && this.serverId) {
        payload.serverId = this.serverId;
        payload.respTimeout = (Number(this.form.waitTimeoutMs) || 500) / 1000;
      }
      api
        .startTask(payload)
        .then((res) => {
          this.loading = false;
          if (res && res.success && res.taskId) {
            this.taskId = res.taskId;
            this.running = true;
            uni.showToast({ title: "已启动", icon: "none" });
            this.openSocket();
            this.startPollFallback();
          } else {
            uni.showToast({ title: "启动失败", icon: "none" });
          }
        })
        .catch(() => {
          this.loading = false;
        });
    },
    onStop() {
      if (!this.running || !this.taskId) return;
      uni.showModal({
        title: "确认停止",
        content: "是否停止当前任务？",
        success: (r) => {
          if (!r.confirm) return;
          this.loading = true;
          api
            .stopTask(this.taskId)
            .then((res) => {
              this.loading = false;
              if (res && res.success) {
                this.running = false;
                this.taskId = "";
                this.closeSocket();
                this.stopPoll();
                uni.showToast({ title: "已停止", icon: "none" });
              } else {
                uni.showToast({ title: "停止失败", icon: "none" });
              }
            })
            .catch(() => {
              this.loading = false;
            });
        },
      });
    },
    openSocket() {
      this.closeSocket();
      if (!this.taskId) return;
      this.sock = new LogSocket(this.taskId, ({ log, timer }) => {
        this.updateLogContent(log, timer);
      });
      this.sock.connect();
    },
    closeSocket() {
      if (this.sock) {
        this.sock.close();
        this.sock = null;
      }
    },
    startPollFallback() {
      this.stopPoll();
      if (!this.taskId) return;
      this.pollTimer = setInterval(() => {
        api.getLog(this.taskId).then((res) => {
          if (res && typeof res.log === "string") {
            this.updateLogContent(res.log, res.timer || "");
          }
        });
      }, 800);
    },
    stopPoll() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    clearLog() {
      this.baselineLen = this.lastRawLen || 0;
      this.logText = "";
      this.scrollTop = 0;
    },
    updateLogContent(log, timer) {
      const raw = typeof log === "string" ? log : "";
      const rawLen = raw.length;
      this.lastRawLen = rawLen;
      if (this.baselineLen > 0) {
        if (rawLen >= this.baselineLen) {
          this.logText = raw.slice(this.baselineLen);
        } else {
          // 服务端日志已重置，清除基准
          this.baselineLen = 0;
          this.logText = raw;
        }
      } else {
        this.logText = raw;
      }
      this.timerText = timer || "";
      this.scrollTop += 100; // 触发滚动到底部
    },
  },
  onShow() {
    this.loadConfig();
  },
  onUnload() {
    this.closeSocket();
    this.stopPoll();
  },
};
</script>

<style>
.wrap {
  min-height: 100vh;
  background: #f8f8f8;
}
.topbar {
  padding: 24rpx 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 36rpx;
  color: #333;
}
.nav {
  display: flex;
  gap: 24rpx;
}
.link {
  color: #007aff;
}
.card {
  background: #fff;
  margin: 20rpx 20rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.section {
  font-size: 30rpx;
  color: #333;
}
.sub {
  display: block;
  margin-top: 6rpx;
  color: #888;
  font-size: 24rpx;
}
.field {
  margin-top: 16rpx;
}
.label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 8rpx;
  display: block;
}
.label.small {
  font-size: 24rpx;
}
.input {
  width: 100%;
  height: 76rpx;
  padding: 0 20rpx;
  border: 1rpx solid #e5e5e5;
  border-radius: 12rpx;
  background: #fff;
  font-size: 28rpx;
  box-sizing: border-box;
}
.picker {
  height: 76rpx;
  line-height: 76rpx;
  padding: 0 20rpx;
  border: 1rpx solid #e5e5e5;
  border-radius: 12rpx;
  background: #fff;
  font-size: 28rpx;
}
.textarea {
  width: 100%;
  min-height: 220rpx;
  padding: 16rpx 20rpx;
  border: 1rpx solid #e5e5e5;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  margin-top: 12rpx;
}
.row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 16rpx;
}
.row.between {
  justify-content: space-between;
}
.col {
  flex: 1;
}
.btns .btn {
  flex: 1;
}
.btn {
  height: 76rpx;
  padding: 0 24rpx;
  background: #e9e9e9;
  color: #333;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.btn.primary {
  background: #007aff;
  color: #fff;
}
.btn.danger {
  background: #dd524d;
  color: #fff;
}
.status {
  color: #666;
  font-size: 24rpx;
}
.timer {
  margin-top: 8rpx;
  color: #9acd32;
  font-size: 24rpx;
  font-family: monospace;
}
.log {
  margin-top: 12rpx;
  background: #111;
  color: #0f0;
  font-family: monospace;
  border-radius: 12rpx;
  padding: 16rpx;
  height: 1000rpx;
  white-space: pre-wrap;
}
</style>
