<script>
	export default {
		onLaunch: function() {
			console.log('App Launch')
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style>
	page {
		background-color: #f8f8f8;
		color: #333;
	}
	.card {
		background: #fff;
		margin: 20rpx;
		padding: 24rpx;
		border-radius: 16rpx;
		box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
	}
	.section {
		font-size: 30rpx;
		color: #333;
	}
	.label {
		font-size: 26rpx;
		color: #666;
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
	.textarea {
		width: 100%;
		min-height: 220rpx;
		padding: 16rpx 20rpx;
		border: 1rpx solid #e5e5e5;
		border-radius: 12rpx;
		font-size: 28rpx;
		box-sizing: border-box;
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
	.row {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}
	.row.between {
		justify-content: space-between;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 8rpx;
		font-size: 24rpx;
		color: #666;
	}
	.dot {
		width: 14rpx;
		height: 14rpx;
		border-radius: 50%;
		background: #999;
	}
	.dot.ok {
		background: #34c759;
	}
	.dot.off {
		background: #c5c5c5;
	}
</style>
