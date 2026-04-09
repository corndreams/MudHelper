<template>
  <view class="wrap">
    <view class="brand">
      <image class="logo" src="/static/logo.png" />
      <text class="brand-name">MUD 工具</text>
    </view>
    <view class="card">
      <view class="tabs">
        <text :class="['tab', tab==='code'?'active':'']" @tap="switchTab('code')">验证码登录</text>
        <text :class="['tab', tab==='pwd'?'active':'']" @tap="switchTab('pwd')">密码登录</text>
        <text :class="['tab', tab==='reg'?'active':'']" @tap="switchTab('reg')">注册</text>
      </view>

      <view v-if="tab==='code'">
        <text class="title">邮箱登录</text>
        <view class="field">
          <input class="input" type="text" v-model="email" placeholder="请输入邮箱" />
        </view>
        <view class="row">
          <input class="input code" type="text" v-model="code" placeholder="验证码" />
          <button class="btn" :disabled="busy || countdown>0" @tap="onSend">{{ countdown>0 ? countdown+'s' : '获取验证码' }}</button>
        </view>
        <button class="btn primary" :disabled="busy || !email || !code" @tap="onSubmit">登录</button>
        <text class="tip">未收到邮件？请检查垃圾箱</text>
      </view>

      <view v-else-if="tab==='pwd'">
        <text class="title">账号/邮箱 + 密码登录</text>
        <view class="field">
          <input class="input" type="text" v-model="account" placeholder="邮箱或用户名" />
        </view>
        <view class="field">
          <input class="input" password v-model="password" placeholder="密码" />
        </view>
        <button class="btn primary" :disabled="busy || !account || !password" @tap="onSubmit">登录</button>
      </view>

      <view v-else>
        <text class="title">注册新账户</text>
        <view class="field">
          <input class="input" type="text" v-model="regEmail" placeholder="邮箱" />
        </view>
        <view class="field">
          <input class="input" type="text" v-model="regUsername" placeholder="用户名" />
        </view>
        <view class="field">
          <input class="input" password v-model="regPassword" placeholder="密码（至少 6 位）" />
        </view>
        <view class="field">
          <input class="input" password v-model="regConfirm" placeholder="确认密码" />
        </view>
        <button class="btn primary" :disabled="busy || !canRegister" @tap="onSubmit">注册并登录</button>
      </view>

      <text class="extra">支持三种方式：验证码登录、账号密码登录、注册后登录。游戏账号/密码在主控页填写。</text>
      <text class="explain" @tap="showExplain">使用说明</text>
    </view>
  </view>
  </template>

<script>
import { api } from '../../utils/http.js'
import { setToken } from '../../utils/auth.js'
export default {
  data() {
    return {
      tab: 'code',
      email: '',
      code: '',
      account: '',
      password: '',
      regEmail: '',
      regUsername: '',
      regPassword: '',
      regConfirm: '',
      busy: false,
      countdown: 0,
      timer: null
    }
  },
  computed: {
    canRegister() {
      return this.regEmail && this.regUsername && this.regPassword && this.regPassword === this.regConfirm && this.regPassword.length >= 6
    }
  },
  methods: {
    switchTab(name) {
      this.tab = name
    },
    showExplain() {
      uni.showModal({
        title: '登录说明',
        content: '• 验证码登录：输入邮箱获取验证码登录（首次即注册）。\\n• 密码登录：使用邮箱或用户名 + 密码登录。\\n• 注册：填写邮箱/用户名/密码完成注册后自动登录。\\n提示：主控页中的“账号/密码”用于连接游戏服务器，与 App 登录凭据不同。',
        showCancel: false
      })
    },
    onSend() {
      if (!this.email) {
        uni.showToast({ title: '请输入邮箱', icon: 'none' })
        return
      }
      if (this.busy || this.countdown > 0) return
      this.busy = true
      api.sendCode(this.email).then(res => {
        this.busy = false
        if (res && res.success) {
          uni.showToast({ title: '验证码已发送', icon: 'none' })
          this.countdown = 60
          this.timer = setInterval(() => {
            if (this.countdown <= 0) {
              clearInterval(this.timer)
              this.timer = null
            } else {
              this.countdown -= 1
            }
          }, 1000)
        } else {
          uni.showToast({ title: '发送失败', icon: 'none' })
        }
      }).catch(() => { this.busy = false })
    },
    onSubmit() {
      if (this.busy) return
      if (this.tab === 'code') {
        if (!this.email || !this.code) return
        this.busy = true
        api.login(this.email, this.code).then(res => {
          this.busy = false
          if (res && res.success && res.token) {
            setToken(res.token)
            uni.showToast({ title: '登录成功', icon: 'none' })
            setTimeout(() => { uni.reLaunch({ url: '/pages/control/index' }) }, 400)
          } else {
            uni.showToast({ title: '验证码错误', icon: 'none' })
          }
        }).catch(() => { this.busy = false })
      } else if (this.tab === 'pwd') {
        if (!this.account || !this.password) return
        this.busy = true
        api.loginPassword(this.account, this.password).then(res => {
          this.busy = false
          if (res && res.success && res.token) {
            setToken(res.token)
            uni.showToast({ title: '登录成功', icon: 'none' })
            setTimeout(() => { uni.reLaunch({ url: '/pages/control/index' }) }, 400)
          } else {
            uni.showToast({ title: '账号或密码错误', icon: 'none' })
          }
        }).catch(() => { this.busy = false })
      } else {
        if (!this.canRegister) return
        this.busy = true
        api.register(this.regEmail, this.regUsername, this.regPassword).then(res => {
          this.busy = false
          if (res && res.success && res.token) {
            setToken(res.token)
            uni.showToast({ title: '注册成功', icon: 'none' })
            setTimeout(() => { uni.reLaunch({ url: '/pages/control/index' }) }, 400)
          } else {
            uni.showToast({ title: '注册失败', icon: 'none' })
          }
        }).catch(() => { this.busy = false })
      }
    }
  },
  onUnload() {
    if (this.timer) clearInterval(this.timer)
  }
}
</script>

<style>
.wrap {
  min-height: 100vh;
  background: linear-gradient(180deg, #f0f5ff, #f8f8f8 60%);
  padding: 60rpx 30rpx 40rpx;
  box-sizing: border-box;
}
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 30rpx;
}
.brand .logo { width: 140rpx; height: 140rpx; }
.brand-name { margin-top: 10rpx; font-size: 32rpx; color: #333; }
.card {
  margin-top: 80rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.tabs { display: flex; gap: 24rpx; margin-bottom: 20rpx; }
.tab { color: #666; font-size: 28rpx; padding: 8rpx 12rpx; border-radius: 10rpx; }
.tab.active { color: #007aff; background: #f1f7ff; }
.title { font-size: 34rpx; color: #333; }
.field { margin-top: 30rpx; }
.row { display: flex; align-items: center; gap: 20rpx; margin-top: 20rpx; }
.input { flex: 1; height: 80rpx; padding: 0 20rpx; border: 1rpx solid #e5e5e5; border-radius: 12rpx; background: #fff; font-size: 28rpx; }
.input.code { flex: 1; }
.btn { height: 80rpx; padding: 0 24rpx; background: #e9e9e9; color: #333; border-radius: 12rpx; font-size: 28rpx; }
.btn.primary { margin-top: 30rpx; background: #007aff; color: #fff; }
.tip { display: block; margin-top: 16rpx; font-size: 24rpx; color: #888; }
.extra { display: block; margin-top: 8rpx; font-size: 24rpx; color: #888; }
.explain { display: block; margin-top: 20rpx; font-size: 26rpx; color: #007aff; }
</style>
