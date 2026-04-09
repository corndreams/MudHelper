<template>
  <scroll-view class="wrap" scroll-y="true">
    <view class="page-head">
      <text class="section">专属组</text>
      <text class="sub">最多 10 个槽位，可在指令中使用 @组名</text>
    </view>
    <view class="card" v-for="g in groups" :key="g.slot">
      <view class="row between">
        <text class="slot">槽位 {{ g.slot }}</text>
        <view class="row">
          <text class="label small">循环</text>
          <input class="input small" type="number" v-model.number="g.loop" />
        </view>
      </view>
      <view class="field">
        <text class="label">名称</text>
        <input class="input" v-model="g.name" placeholder="例如：采集" />
      </view>
      <view class="field">
        <text class="label">指令（每行一条）</text>
        <textarea
          class="textarea"
          v-model="g.commands"
          placeholder="go east\nget all"
          :maxlength="-1"
        />
      </view>
    </view>
    <view class="footer">
      <button class="btn primary" :disabled="saving" @tap="onSave">
        保存全部
      </button>
    </view>
  </scroll-view>
</template>

<script>
import { api } from "../../utils/http.js";
export default {
  data() {
    return {
      groups: [],
      saving: false,
    };
  },
  methods: {
    load() {
      api.getGroups().then((res) => {
        if (res && res.success && Array.isArray(res.groups)) {
          // 深拷贝避免响应式异常
          this.groups = res.groups.map((it) => ({
            slot: it.slot,
            name: it.name || "",
            commands: it.commands || "",
            loop: it.loop != null ? it.loop : 1,
          }));
        }
      });
    },
    onSave() {
      this.saving = true;
      const payload = this.groups.map((g) => ({
        slot: g.slot,
        name: g.name,
        commands: g.commands,
        loop: g.loop,
      }));
      api
        .saveGroups(payload)
        .then((res) => {
          this.saving = false;
          if (res && res.success) {
            uni.showToast({ title: "已保存", icon: "none" });
          } else {
            uni.showToast({ title: "保存失败", icon: "none" });
          }
        })
        .catch(() => {
          this.saving = false;
        });
    },
  },
  onShow() {
    this.load();
  },
};
</script>

<style>
.wrap {
  min-height: 100vh;
  background: #f8f8f8;
}
.page-head {
  padding: 20rpx;
}
.sub {
  display: block;
  margin-top: 6rpx;
  color: #888;
  font-size: 24rpx;
}
.card {
  background: #fff;
  margin: 20rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.between {
  justify-content: space-between;
}
.slot {
  color: #333;
  font-size: 30rpx;
}
.field {
  margin-top: 14rpx;
}
.label {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 8rpx;
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
.input.small {
  width: 140rpx;
}
.textarea {
  width: 100%;
  min-height: 180rpx;
  padding: 16rpx 20rpx;
  border: 1rpx solid #e5e5e5;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}
.footer {
  padding: 0 20rpx 40rpx;
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
</style>
