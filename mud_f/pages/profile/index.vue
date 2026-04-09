<template>
  <view class="wrap">
    <view class="card">
      <text class="section">账号</text>
      <view class="row">
        <text class="label">邮箱</text>
        <text class="val">{{ userEmail || '-' }}</text>
      </view>
    </view>

    <view class="card">
      <button class="btn danger" @tap="logout">退出登录</button>
    </view>
  </view>
</template>

<script>
import { api } from '../../utils/http.js'
import { clearToken } from '../../utils/auth.js'
export default {
  data() {
    return {
      userEmail: ''
    }
  },
  methods: {
    load() {
      api.me().then(res => {
        if (res && res.ok && res.user) {
          this.userEmail = res.user.email || ''
        }
      })
    },
    logout() {
      clearToken()
      uni.reLaunch({ url: '/pages/auth/login' })
    }
  },
  onShow() { this.load() }
}
</script>

<style>
.wrap { min-height: 100vh; background: #f8f8f8; padding-bottom: 30rpx; }
.card {
  background: #fff;
  margin: 20rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}
.section { font-size: 30rpx; color: #333; }
.row { display: flex; align-items: center; justify-content: space-between; margin-top: 10rpx; }
.label { color: #666; font-size: 26rpx; }
.val { color: #333; font-size: 28rpx; }
.field { margin-top: 14rpx; }
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
.btn {
  margin-top: 16rpx;
  height: 76rpx;
  padding: 0 24rpx;
  background: #e9e9e9;
  color: #333;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.btn.danger { background: #dd524d; color: #fff; }
</style>
