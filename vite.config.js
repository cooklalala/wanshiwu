import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// 构建结束后把 cloudfunctions/ 拷进小程序产物目录,
// 微信开发者工具才能识别并上传部署云函数(dev watch 每次重新编译也会同步)
function copyCloudFunctions() {
  return {
    name: 'copy-cloud-functions',
    closeBundle() {
      const outDir = process.env.UNI_OUTPUT_DIR
      const src = join(__dirname, 'cloudfunctions')
      if (!outDir || !outDir.includes('mp-weixin') || !existsSync(src)) return
      cpSync(src, join(outDir, 'cloudfunctions'), { recursive: true })
    }
  }
}

export default defineConfig({
  plugins: [uni(), copyCloudFunctions()]
})
