<template>
  <u-popup :show="show" mode="bottom" :round="28" :safe-area-inset-bottom="true" @close="onSkip">
    <view class="celebrate">
      <!-- 点亮徽章:一枚暖色的小光点 -->
      <view class="celebrate__badge">
        <view class="celebrate__badge-glow"></view>
        <view class="celebrate__badge-dot"></view>
      </view>

      <text class="celebrate__title">{{ title }}</text>
      <text class="celebrate__sub">{{ subtitle }}</text>

      <!-- 照片(选填) -->
      <view v-if="remainPhotos > 0" class="celebrate__section">
        <text class="celebrate__label">
          留张照片吧<text class="celebrate__hint">(选填{{ existingPhotos ? `,已有 ${existingPhotos} 张` : '' }})</text>
        </text>
        <view class="celebrate__grid">
          <view v-for="(path, i) in photos" :key="i" class="celebrate__cell">
            <image class="celebrate__img" :src="path" mode="aspectFill" />
            <view class="celebrate__del" @click="photos.splice(i, 1)">
              <u-icon name="close" size="12" color="#ffffff"></u-icon>
            </view>
          </view>
          <view v-if="photos.length < remainPhotos" class="celebrate__cell celebrate__add" @click="choosePhotos">
            <u-icon name="camera-fill" size="26" color="#d8a48f"></u-icon>
            <text class="celebrate__add-text">选照片</text>
          </view>
        </view>
      </view>

      <!-- 一句话记录(选填) -->
      <view class="celebrate__section">
        <text class="celebrate__label">写一句话记录此刻<text class="celebrate__hint">(选填)</text></text>
        <view class="celebrate__note">
          <u-textarea
            v-model="note"
            placeholder="比如:今天的晚霞特别温柔"
            border="none"
            maxlength="100"
            :custom-style="{ background: 'transparent', padding: '0' }"
          ></u-textarea>
        </view>
      </view>

      <view class="celebrate__actions">
        <view class="celebrate__skip" hover-class="celebrate__skip--hover" @click="onSkip">先不啦</view>
        <view
          class="celebrate__done"
          :class="{ 'celebrate__done--disabled': saving }"
          hover-class="celebrate__done--hover"
          @click="onDone"
        >
          <u-loading-icon v-if="saving" size="18" color="#ffffff"></u-loading-icon>
          <text>{{ saving ? '保存中' : '完成打卡' }}</text>
        </view>
      </view>
    </view>
  </u-popup>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

/**
 * 打卡成功的温馨反馈卡片
 * 展示点亮文案,并允许补传照片/写一句话(都是选填)
 * finish 事件携带 { photos, note },由父页面负责上传保存
 */
const props = defineProps({
  show: Boolean,
  countyName: { type: String, default: '' },
  // 这次是第几次打卡该县
  visitCount: { type: Number, default: 1 },
  // 是否首次点亮该县
  isFirst: { type: Boolean, default: true },
  // 该县原有照片数(重复打卡追加照片用)
  existingPhotos: { type: Number, default: 0 },
  // 本次打卡是否达成了一条「我想去」心愿(标题副文案换成心愿达成版)
  wishAchieved: { type: Boolean, default: false },
  // 父页面保存中的状态,驱动按钮 loading
  saving: Boolean
})
const emit = defineEmits(['update:show', 'finish'])

const MAX_PHOTOS = 9

const photos = ref([])
const note = ref('')

const isFirst = computed(() => props.isFirst)
const remainPhotos = computed(() => Math.max(0, MAX_PHOTOS - props.existingPhotos))

const FIRST_SUBS = [
  '又多了一个有故事的地方',
  '这片角落从此有了你的足迹',
  '把此刻的欢喜留在了这里'
]
const AGAIN_SUBS = [
  '老地方,新心情',
  '这里的光,又为你亮了一次',
  '重逢也是一种浪漫'
]
// 每次打开随机挑一句,避免每次打卡都是同一句话
const subtitle = ref(FIRST_SUBS[0])

const title = computed(() =>
  props.wishAchieved
    ? '心愿达成 🎉'
    : isFirst.value
      ? `点亮了 ${props.countyName}`
      : `第 ${props.visitCount} 次来到 ${props.countyName}`
)

watch(
  () => props.show,
  (show) => {
    if (!show) return
    photos.value = []
    note.value = ''
    subtitle.value = props.wishAchieved
      ? `终于来到了心心念念的${props.countyName}`
      : (isFirst.value ? FIRST_SUBS : AGAIN_SUBS)[(Math.random() * 3) | 0]
  }
)

async function choosePhotos() {
  try {
    const res = await uni.chooseMedia({
      count: remainPhotos.value - photos.value.length,
      mediaType: ['image'],
      sizeType: ['compressed']
    })
    photos.value.push(...res.tempFiles.map((f) => f.tempFilePath))
  } catch (e) {
    // 用户取消,忽略
  }
}

function onSkip() {
  if (props.saving) return
  emit('update:show', false)
}

function onDone() {
  if (props.saving) return
  emit('finish', { photos: photos.value, note: note.value.trim() })
}
</script>

<style lang="scss" scoped>
.celebrate {
  padding: 40rpx 40rpx 28rpx;
  background: linear-gradient(180deg, #fff6f1 0%, #ffffff 40%);
  border-radius: 28rpx 28rpx 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;

  // ---- 点亮徽章 ----
  &__badge {
    position: relative;
    width: 72rpx;
    height: 72rpx;
    margin-bottom: 20rpx;
  }

  &__badge-glow {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 209, 102, 0.9) 0%, rgba(255, 176, 58, 0.25) 55%, rgba(255, 176, 58, 0) 75%);
    animation: badge-breathe 1.8s ease-in-out infinite;
  }

  &__badge-dot {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 26rpx;
    height: 26rpx;
    margin: -13rpx 0 0 -13rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #ffd166 0%, #ffb03a 100%);
    box-shadow: 0 0 16rpx rgba(255, 176, 58, 0.8);
  }

  &__title {
    font-size: 40rpx;
    font-weight: 700;
    color: #4a3b35;
    letter-spacing: 2rpx;
  }

  &__sub {
    font-size: 26rpx;
    color: #b59a8f;
    margin-top: 12rpx;
  }

  // ---- 选填区 ----
  &__section {
    width: 100%;
    margin-top: 32rpx;
  }

  &__label {
    font-size: 28rpx;
    font-weight: 500;
    color: #4a3b35;
  }

  &__hint {
    font-size: 22rpx;
    font-weight: 400;
    color: #c9b3a9;
    margin-left: 8rpx;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin-top: 20rpx;
  }

  &__cell {
    position: relative;
    width: 100%;
    height: 180rpx;
    border-radius: 16rpx;
    overflow: hidden;
  }

  &__img {
    width: 100%;
    height: 100%;
  }

  &__del {
    position: absolute;
    top: 8rpx;
    right: 8rpx;
    width: 36rpx;
    height: 36rpx;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__add {
    border: 2rpx dashed #eccfc2;
    background: #fffaf7;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  &__add-text {
    font-size: 22rpx;
    color: #d8a48f;
    margin-top: 8rpx;
  }

  &__note {
    margin-top: 20rpx;
    padding: 20rpx 24rpx;
    background: #fffaf7;
    border: 2rpx solid #f6e6dd;
    border-radius: 16rpx;
  }

  // ---- 底部按钮 ----
  &__actions {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 24rpx;
    margin-top: 40rpx;
  }

  &__skip {
    padding: 22rpx 8rpx;
    font-size: 28rpx;
    color: #b59a8f;
  }

  &__skip--hover {
    opacity: 0.6;
  }

  &__done {
    flex: 1;
    height: 88rpx;
    border-radius: 999rpx;
    background: linear-gradient(135deg, #ffb03a 0%, #ff8fa3 60%, #ff5c74 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    font-size: 30rpx;
    font-weight: 600;
    color: #ffffff;
    letter-spacing: 2rpx;
    box-shadow: 0 8rpx 24rpx rgba(255, 143, 122, 0.35);
  }

  &__done--hover {
    transform: scale(0.97);
  }

  &__done--disabled {
    opacity: 0.7;
  }
}

@keyframes badge-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.18);
    opacity: 0.75;
  }
}
</style>
