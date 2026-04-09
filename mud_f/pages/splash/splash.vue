<template>
  <view class="splash">
    <image class="logo" src="/static/logo.png" />
    <text class="name">MUD 工具</text>
  </view>
</template>

<script>
import { getToken } from '../../utils/auth.js'
export default {
  onShow() {
    const hasToken = !!getToken()
    setTimeout(() => {
      if (hasToken) {
        uni.reLaunch({ url: '/pages/control/index' })
      } else {
        uni.reLaunch({ url: '/pages/auth/login' })
      }
    }, 400)
  }
}
</script>

<style>
.splash {
  flex: 1;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
}
.logo {
  width: 180rpx;
  height: 180rpx;
  margin-bottom: 20rpx;
}
.name {
  font-size: 34rpx;
  color: #333;
}
</style>
