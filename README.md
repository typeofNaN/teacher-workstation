# 任课老师工作台

一款 **本地优先** 的任课教师桌面工作台：课表与调课、教学进度、可视化课堂、作业登记、成绩录入与分析、AI 备课助手，全部数据保存在本机 JSON 文件中，支持一键导出 / 导入迁移。

技术栈：Electron · TypeScript · React 18 · Vite · TailwindCSS · shadcn/ui 风格组件 · Zustand · Recharts。

## 功能

| 模块 | 能力 |
| --- | --- |
| 首次向导 | 选老师形象、称呼、任教学科 → 载入示例数据或直接开始 |
| 工作台 | 今日课程时间轴（含进行中 / 已结束 / 已调课）、下次上课、各班当前课题（可一键「讲完了」）、作业检查提醒、班级卡片 |
| 课堂 | 可视化教室座位表（拖动 / 点选调座位）、随机点名、课堂计时、课堂点评与课堂之星、全屏投屏模式 |
| 课表 | 固定课表（每周都这样）+ 单日调课 / 两节对调 / 停课；区分正课、早读、辅导、晚自习、课后服务、教研、值班等类型 |
| 教学进度 | 一份课题清单，各班独立标记完成情况；进度正常 / 快慢课题对比、当前课题、课时统计 |
| 作业 | 一份作业布置给多个班；分班登记已交 / 优秀 / 需订正 / 未交；「其余都已交」、批量操作、一键复制未交名单 |
| 成绩 | 多班同场考试；总分制或按大题（选择 / 填空 / 解答）录分；从表格粘贴导入；平行班对照、分数段、历次趋势、分项得分率（60% 及格线）、排名 |
| 学生名单 | 花名册、搜索、批量粘贴导入（姓名,学号,性别）；删除学生级联清理成绩与登记 |
| AI 助手 | 备课教案 / 分层作业 / 试卷分析 / 学科评语模板；自动带上班级学情（学生姓名匿名化）；可复制提示词，也可配置 OpenAI 兼容接口直接生成 |
| 设置 | 个人信息与学期、班级管理（含座位行列）、作息节次、主题、AI 接口、数据导出 / 导入 / 清空 |

## 开发

环境要求：Node.js ≥ 18（推荐 20/22）。推荐使用 pnpm（≥ 10）。

> **pnpm 10 用户注意**：pnpm 默认不执行依赖的 postinstall 脚本，Electron 二进制不会自动下载。
> 本项目已在 `package.json` 的 `pnpm.onlyBuiltDependencies` 中放行 `electron` / `esbuild`，
> 并通过 `.npmrc` 将 Electron 二进制指向国内镜像。如果安装后仍报 `Error: Electron uninstall`，
> 执行 `pnpm rebuild electron` 重新触发下载即可。

```bash
pnpm install
pnpm dev        # 启动 Electron + Vite 开发环境
pnpm typecheck  # 类型检查（主进程 / 渲染进程）
pnpm lint       # ESLint
pnpm format     # Prettier
pnpm build      # 类型检查 + 生产构建
pnpm dist:mac   # 打包 macOS 安装包（dist:win / dist 同理）
```

首次启动会写入一份示例数据（3 个班级、12 节课、一次周测成绩等），方便直接看到各模块的效果；
在「设置 → 数据管理 → 清空全部数据」即可得到干净的工作台。

## 打包与自动发布

### 本地打包

```bash
pnpm dist:mac   # 生成当前架构的 dmg + zip
pnpm dist:win   # 仅建议在 Windows 上执行：macOS 打 Windows 包需要 wine，容易失败
```

需要指定架构时用 `pnpm exec electron-builder --mac --arm64`（或 `--x64`）。

> **一次不要构建多个架构**：electron-builder 会并行处理各架构，并发调用 `hdiutil` 时系统报
> `Only one image can be created at a time`，直接失败。

> 本地打包首次会下载约 100MB 的 Electron 预编译包。国内网络若卡在 github.com，
> 可前置镜像变量：`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm dist:mac`。

> 在 macOS 上构建 Windows 安装包依赖 wine 改写 exe 图标与版本信息，Apple Silicon + 新版 macOS 下经常不可用。
> **推荐直接用 GitHub Actions 构建**：两个平台的产物都在各自的原生系统上生成，不依赖 wine。

### GitHub Actions 自动发布

工作流文件：`.github/workflows/release.yml`。推送 `v*` 形式的标签即自动构建并发布：

```bash
git tag v1.0.0
git push origin v1.0.0
```

流程说明：

1. **版本号**：从标签去掉 `v` 前缀写入 `package.json`（`v1.0.0` → `1.0.0`），标签格式非法会直接失败；
2. **并行构建**：三个独立 job 同时跑 —— `macos-latest` 出 arm64 的 dmg + zip、`macos-latest` 出 x64 的 dmg + zip、`windows-latest` 出 x64 的 nsis 安装包；
3. **合并发布**：所有平台构建成功后，统一创建 GitHub Release，附上安装包、`*.blockmap` 与 `SHA256SUMS.txt`；
4. 任何平台构建失败则**不会**发布，避免出现缺平台的残缺版本。

手动触发（`workflow_dispatch`）只构建并上传 artifact，不创建 Release，用于验证打包流程。

产物命名统一为 ASCII，避免中文文件名在下载链接中被转义：

| 平台 | 文件 |
| --- | --- |
| Windows | `TeacherWorkstation-<version>-win-x64.exe` |
| macOS Apple 芯片 | `TeacherWorkstation-<version>-mac-arm64.dmg` |
| macOS Intel | `TeacherWorkstation-<version>-mac-x64.dmg` |

### 关于签名

默认不配置证书，CI 里通过 `scripts/after-pack.cjs` 给 macOS 应用做 **ad-hoc 签名**——Apple Silicon 要求可执行文件必须有签名，否则打包后的应用会被系统判定「已损坏」。用户首次打开需要右键「打开」，或执行：

```bash
xattr -dr com.apple.quarantine /Applications/任课老师工作台.app
```

若要正式签名 / 公证，在仓库 Secrets 中配置 `CSC_LINK`、`CSC_KEY_PASSWORD`（可选 `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`），并删除工作流中的 `CSC_IDENTITY_AUTO_DISCOVERY: false` 即可，`afterPack` 钩子检测到证书后会自行跳过 ad-hoc 签名。

## 数据存储

- **Electron 运行时**：`{userData}/data/teacher-workstation.json`
  - macOS：`~/Library/Application Support/teacher-workstation/data/`
  - Windows：`%APPDATA%/teacher-workstation/data/`
  - Linux：`~/.config/teacher-workstation/data/`
- **浏览器预览**（无 Electron API 时）：自动降级到 `localStorage`，方便调试。
- 写入采用「临时文件 + rename」的原子写策略；文件损坏时自动备份为 `.broken-<时间戳>` 并回退到空数据，保证应用仍可启动。
- 导入时会校验必要字段，避免脏文件覆盖本地数据。

## 目录结构

```
src/
├─ main/          # Electron 主进程：窗口、IPC、文件读写、导入导出对话框
├─ preload/       # contextBridge 白名单 API
├─ shared/        # 主进程与渲染进程共享的数据模型与默认数据
└─ renderer/src/
   ├─ components/ # 布局、通用业务组件、shadcn 风格 UI 原子组件
   ├─ pages/      # 九个业务页面
   ├─ lib/        # 工具函数、统计分析、存储适配、常量
   └─ store/      # Zustand 全局状态 + 防抖持久化
```

## 安全与工程约定

- `contextIsolation: true`、`nodeIntegration: false`，渲染进程只能通过 preload 暴露的白名单方法访问文件系统。
- CSP 限制脚本来源，外部链接交由系统浏览器打开。
- 严格 TypeScript（`strict`、`noUnusedLocals`、`noUnusedParameters`），ESLint 9 flat config + Prettier 统一风格。
- 删除班级 / 学生 / 节次时级联清理关联数据，避免孤儿记录。
