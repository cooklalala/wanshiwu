<template>
  <!-- 全屏礼花层:不拦截任何触摸,只在打卡成功时绽放 -->
  <canvas type="2d" id="fireworksCanvas" class="fireworks"></canvas>
</template>

<script setup>
import { onMounted, getCurrentInstance } from 'vue'

/**
 * 打卡成功的礼花动效(暖色系,温馨向)
 * 用法:ref 拿到组件后调用 celebrate(),会在屏幕中上方错落绽放几簇礼花
 */

const instance = getCurrentInstance()

// 温馨的暖色粒子
const COLORS = ['#ff5c74', '#ff8fa3', '#ffb03a', '#ffd166', '#fff3b0', '#ffa6b6']

let canvasNode = null
let ctx = null
let cssWidth = 0
let cssHeight = 0

let particles = []
let rafId = 0
let pendingTimers = []

function setupCanvas() {
  uni
    .createSelectorQuery()
    .in(instance.proxy)
    .select('#fireworksCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res || !res[0] || !res[0].node) return
      const { node, width, height } = res[0]
      canvasNode = node
      cssWidth = width
      cssHeight = height
      const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
      const dpr = info.pixelRatio || 2
      canvasNode.width = width * dpr
      canvasNode.height = height * dpr
      ctx = node.getContext('2d')
      ctx.scale(dpr, dpr)
    })
}

// 在 (x, y) 绽放一簇礼花
function burst(x, y) {
  const count = 56
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25
    const speed = 2 + Math.random() * 3.6
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.6,
      life: 0,
      maxLife: 46 + Math.random() * 26,
      size: 1.6 + Math.random() * 2.2,
      color: COLORS[(Math.random() * COLORS.length) | 0]
    })
  }
  startLoop()
}

function startLoop() {
  if (rafId) return
  // 小程序 canvas 节点自带 rAF,H5 端兜底用 window 的
  const raf = canvasNode.requestAnimationFrame
    ? canvasNode.requestAnimationFrame.bind(canvasNode)
    : requestAnimationFrame
  const step = () => {
    draw()
    if (particles.length) {
      rafId = raf(step)
    } else {
      rafId = 0
      ctx.clearRect(0, 0, cssWidth, cssHeight)
    }
  }
  rafId = raf(step)
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  particles = particles.filter((p) => p.life < p.maxLife)
  for (const p of particles) {
    p.life++
    // 重力 + 轻微阻尼,让粒子呈抛物线缓缓飘落
    p.vy += 0.055
    p.vx *= 0.985
    p.vy *= 0.985
    p.x += p.vx
    p.y += p.vy
    const fade = 1 - p.life / p.maxLife
    ctx.globalAlpha = fade
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * (0.6 + fade * 0.4), 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** 绽放礼花:在屏幕中上方错落开几簇,持续约 1.5s */
function celebrate() {
  if (!canvasNode) return
  // 清掉上一场未放完的定时器,避免连点时礼花越积越多
  pendingTimers.forEach(clearTimeout)
  pendingTimers = []
  const spots = [
    [0.5, 0.32, 0],
    [0.28, 0.42, 260],
    [0.72, 0.4, 480],
    [0.5, 0.24, 700]
  ]
  for (const [fx, fy, delay] of spots) {
    pendingTimers.push(
      setTimeout(() => burst(cssWidth * fx, cssHeight * fy), delay)
    )
  }
}

defineExpose({ celebrate })

onMounted(setupCanvas)
</script>

<style scoped>
.fireworks {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 90;
  pointer-events: none;
}
</style>
