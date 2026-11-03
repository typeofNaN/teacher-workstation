'use strict'

const { execFileSync } = require('node:child_process')
const path = require('node:path')

/**
 * electron-builder 的 afterPack 钩子：在 macOS 打包结束、生成 dmg/zip 之前，
 * 对 .app 做一次 ad-hoc 签名（codesign --sign -）。
 *
 * 为什么需要：
 * - Apple Silicon 要求所有可执行文件具备有效签名。Electron 预编译的二进制自带 ad-hoc 签名，
 *   但打包过程会写入 asar、改写 Info.plist、替换图标，原签名随之失效，
 *   系统会把应用判定为「已损坏，应移到废纸篓」。
 * - 在没有 Apple 开发者证书的场景下（本地构建 / GitHub Actions 公开仓库），
 *   ad-hoc 签名是让应用能直接双击运行的唯一办法。
 * - 若将来在 CI 中配置了 CSC_LINK 正式证书，electron-builder 会在本钩子之后
 *   用正式证书重新签名并覆盖这里的 ad-hoc 签名，互不影响。
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  // 配置了正式签名证书时不干预，交给 electron-builder 自己的签名流程处理
  if (process.env.CSC_LINK || process.env.CSC_NAME || process.env.CSC_KEY_PASSWORD) {
    console.log('[after-pack] 检测到正式签名证书，跳过 ad-hoc 签名')
    return
  }

  const { appOutDir, packager } = context
  const appPath = path.join(appOutDir, `${packager.appInfo.productFilename}.app`)

  console.log(`[after-pack] 对应用做 ad-hoc 签名: ${appPath}`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit'
  })

  try {
    execFileSync('codesign', ['--verify', '--deep', '--verbose=2', appPath], {
      stdio: 'inherit'
    })
    console.log('[after-pack] 签名校验通过')
  } catch {
    // ad-hoc 签名下偶尔会报 resource fork / xattr 之类的告警，不影响运行
    console.warn('[after-pack] 签名校验存在告警（ad-hoc 签名常见，通常不影响运行）')
  }
}
