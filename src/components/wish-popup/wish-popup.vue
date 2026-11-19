<template>
  <u-popup :show="show" mode="bottom" :round="20" :safe-area-inset-bottom="true" @close="onClose">
    <view class="wish-popup">
      <view class="wish-popup__header">
        <text class="wish-popup__title">想去的地方</text>
        <text class="wish-popup__count">{{ wishes.length }} 个心愿</text>
      </view>

      <scroll-view scroll-y class="wish-popup__body">
        <view v-for="w in wishes" :key="w._id" class="wish-card">
          <text class="wish-card__star">⭐</text>
          <view class="wish-card__main">
            <view class="wish-card__row">
              <text class="wish-card__name">{{ w.county }}</text>
              <text class="wish-card__region">{{ w.province }}{{ w.city ? ` · ${w.city}` : '' }}</text>
            </view>
            <text v-if="w.note" class="wish-card__note">“{{ w.note }}”</text>
          </view>
          <view class="wish-card__del" hover-class="wish-card__del--hover" @click="onRemove(w)">
            <text class="wish-card__del-text">取消</text>
          </view>
        </view>

        <view v-if="!wishes.length" class="wish-popup__empty">
          <text class="wish-popup__empty-title">还没有心愿</text>
          <text class="wish-popup__empty-sub">点亮地图前,先许个愿吧 ✨</text>
        </view>
      </scroll-view>

      <view class="wish-popup__footer">
        <text class="wish-popup__tip">放大到省份视图,点击想去区县就能许下心愿</text>
      </view>
    </view>
  </u-popup>
</template>

<script setup>
/**
 * 「我想去」心愿清单弹层
 * 展示所有心愿(区县 + 一句话),支持取消心愿
 * remove 事件携带心愿对象,由父页面负责确认和删除
 */
defineProps({
  show: Boolean,
  // 心愿数组: { _id, province, city, county, countyAdcode, note }
  wishes: {
    type: Array,
    default: () => []
  }
})
const emit = defineEmits(['update:show', 'remove'])

function onClose() {
  emit('update:show', false)
}

function onRemove(wish) {
  emit('remove', wish)
}
</script>

<style lang="scss" scoped>
.wish-popup {
  padding: 32rpx 32rpx 24rpx;

  &__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 24rpx;
  }

  &__title {
    font-size: 36rpx;
    font-weight: 600;
    color: #303133;
  }

  &__count {
    font-size: 24rpx;
    color: #909399;
  }

  &__body {
    max-height: 62vh;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80rpx 0;
  }

  &__empty-title {
    font-size: 30rpx;
    color: #606266;
  }

  &__empty-sub {
    margin-top: 12rpx;
    font-size: 24rpx;
    color: #b59a8f;
  }

  &__footer {
    display: flex;
    justify-content: center;
    padding-top: 20rpx;
  }

  &__tip {
    font-size: 22rpx;
    color: #c3cad9;
  }
}

.wish-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
  padding: 24rpx;
  background: #faf8ff;
  border: 2rpx solid #ece6fb;
  border-radius: 20rpx;

  &__star {
    flex-shrink: 0;
    font-size: 36rpx;
  }

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  &__row {
    display: flex;
    align-items: baseline;
    gap: 12rpx;
  }

  &__name {
    font-size: 30rpx;
    font-weight: 500;
    color: #303133;
  }

  &__region {
    font-size: 22rpx;
    color: #909399;
  }

  &__note {
    margin-top: 8rpx;
    font-size: 26rpx;
    color: #7a6f96;
  }

  &__del {
    flex-shrink: 0;
    padding: 10rpx 24rpx;
    background: rgba(167, 139, 250, 0.12);
    border-radius: 999rpx;
  }

  &__del--hover {
    background: rgba(167, 139, 250, 0.25);
  }

  &__del-text {
    font-size: 24rpx;
    color: #8b7ad8;
  }
}
</style>
