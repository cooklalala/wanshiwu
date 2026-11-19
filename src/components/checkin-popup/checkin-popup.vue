<template>
  <u-popup :show="show" mode="bottom" :round="20" :safe-area-inset-bottom="true" @close="onClose">
    <view class="checkin-popup">
      <view class="checkin-popup__header">
        <text class="checkin-popup__title">{{ provinceName }}</text>
        <text class="checkin-popup__count">共 {{ totalPhotos }} 张照片</text>
      </view>

      <scroll-view scroll-y class="checkin-popup__body">
        <view v-if="loading" class="checkin-popup__loading">
          <u-loading-icon></u-loading-icon>
        </view>

        <view v-for="(item, idx) in entries" :key="idx" class="checkin-entry">
          <view class="checkin-entry__meta">
            <text class="checkin-entry__title">{{ item.title || '未命名打卡' }}</text>
            <text class="checkin-entry__date">{{ item.date }}</text>
          </view>
          <text v-if="item.note" class="checkin-entry__note">{{ item.note }}</text>
          <view class="checkin-entry__grid">
            <image
              v-for="(url, i) in item.urls"
              :key="i"
              class="checkin-entry__photo"
              :src="url"
              mode="aspectFill"
              lazy-load
              @click="preview(item.urls, i)"
            />
          </view>
        </view>

        <u-empty v-if="!loading && !entries.length" mode="data" text="还没有打卡照片"></u-empty>
      </scroll-view>

      <!-- 补救入口:当时忘了打卡,补一段回忆回来 -->
      <view class="checkin-popup__footer">
        <view class="supplement" hover-class="supplement--hover" @click="onSupplement">
          <u-icon name="edit-pen" size="14" color="#ff5c74"></u-icon>
          <text class="supplement__text">补充这段回忆</text>
        </view>
      </view>
    </view>
  </u-popup>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getTempUrls } from '@/common/cloud.js'

const props = defineProps({
  show: Boolean,
  provinceName: String,
  // 该省份的打卡记录数组: { title, note, date, photos: [fileID] }
  checkins: {
    type: Array,
    default: () => []
  }
})
const emit = defineEmits(['update:show', 'supplement'])

const entries = ref([])
const loading = ref(false)

const totalPhotos = computed(() => props.checkins.reduce((n, c) => n + (c.photos?.length || 0), 0))

// 当前查看区域的区县 adcode(省级旧数据没有,退化为省码,补回忆页兜底不预填)
const regionAdcode = computed(() => {
  const c = props.checkins[0]
  return c ? c.countyAdcode ?? c.adcode : null
})

watch(
  () => props.show,
  async (show) => {
    if (!show) return
    loading.value = true
    entries.value = []
    try {
      // 每条打卡的照片 fileID 换成临时 https 链接,previewImage 需要
      const result = await Promise.all(
        props.checkins.map(async (c) => ({
          title: c.title,
          note: c.note,
          date: c.date,
          urls: await getTempUrls(c.photos || [])
        }))
      )
      entries.value = result
    } catch (e) {
      console.error('获取照片链接失败', e)
      uni.showToast({ title: '照片加载失败', icon: 'none' })
    } finally {
      loading.value = false
    }
  }
)

function preview(urls, current) {
  uni.previewImage({ urls, current })
}

function onClose() {
  emit('update:show', false)
}

function onSupplement() {
  emit('supplement', regionAdcode.value)
  emit('update:show', false)
}
</script>

<style lang="scss" scoped>
.checkin-popup {
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

  &__footer {
    display: flex;
    justify-content: center;
    padding-top: 20rpx;
  }

  &__loading {
    display: flex;
    justify-content: center;
    padding: 60rpx 0;
  }
}

.supplement {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 32rpx;
  background: rgba(255, 92, 116, 0.1);
  border-radius: 999rpx;

  &__text {
    font-size: 24rpx;
    color: #ff5c74;
  }
}

.supplement--hover {
  background: rgba(255, 92, 116, 0.22);
}

.checkin-entry {
  margin-bottom: 32rpx;

  &__meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  &__title {
    font-size: 30rpx;
    font-weight: 500;
    color: #303133;
  }

  &__date {
    font-size: 24rpx;
    color: #909399;
  }

  &__note {
    display: block;
    font-size: 26rpx;
    color: #606266;
    margin: 8rpx 0;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12rpx;
    margin-top: 16rpx;
  }

  &__photo {
    width: 100%;
    height: 220rpx;
    border-radius: 12rpx;
    background-color: #f2f3f5;
  }
}
</style>
