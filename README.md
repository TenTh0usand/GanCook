<div align="center">

<img src="public/logo.webp" width="96" height="96" alt="干饭厨子" />

# 🍳 干饭厨子 · GanCook-10k

**自部署到家庭 NAS 的点菜、备菜与厨房分工系统 —— 让一家人点菜、买菜、下厨、打分有迹可循。**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-单文件-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

中文 · [English](README.en.md)

</div>

---

> **GanCook-10k** 是面向自家日常使用持续二次开发的定制版本，所有数据（SQLite 数据库与菜品/备菜照片）完全保存在本地 NAS 上，不依赖任何云服务。

## ✨ 核心特性

- 🍽️ **双菜单点菜体验** —— 支持「家常菜单」（手动精选 + 近 3 个月常做菜品自动入选）与「完整菜单」（二级分类导航 + 搜索 + 常做排序），顶部支持**本季推荐海报**。
- 🌙 **五餐次 + 跨午夜夜宵** —— 覆盖早餐、午餐、加餐、晚餐、夜宵；凌晨 `02:00` 前仍自然归属前一天营业日，跨零点开夜宵不会错乱。
- 🥕 **备菜与买菜账本** —— 按天/餐次记录买的食材、冰箱存货、处理方式与小票照片，自动汇总当日与本周买菜花费，并联动打卡「备菜」。
- 👨‍👩‍👧 **四角色家务分工与热力图** —— 备菜、做菜（支持多人掌勺）、点菜、善后四色分工打卡，统计页支持按角色筛选热力图。
- ⭐ **双模式餐后打分** —— 支持 `0.5` 步进半星简易打分，或味道、口感、卖相、份量、性价比、体验六维科学雷达图评分。
- ⏰ **自动饭局调度** —— 按星期与时间自动开局、到点截止进入做饭、餐后自动归档完成。
- 👆 **选头像 + 6 位密码登录** —— 共享设备免打字点选头像登录，内置连续输错限流保护。
- 🥛 **牛奶布艺 UI + 中英双语** —— 柔和拟物视觉，支持 PWA 安装到手机主屏与一键切换中英文。

## 🚀 部署运行（Docker Compose）

```bash
git clone https://github.com/TenTh0usand/GanCook.git
cd GanCook
docker compose up -d --build
```

打开 `http://<你的NAS地址>:3000`，首次访问按引导建立家庭并设置 6 位管理员密码即可。

可选环境变量：

| 变量 | 默认 | 说明 |
|------|------|------|
| `TZ` | `Asia/Shanghai` | 家庭时区，影响日期归属与自动饭局调度 |
| `DATA_DIR` | `/data`（容器）/ `./data`（本地） | SQLite 数据库与上传图片的存储目录 |
| `AUTH_SECRET` | 自动生成 | 会话签名密钥（Docker 首启自动生成并持久化到 `data/auth.secret`） |
| `CRON_SECRET` | 自动生成 | `/api/cron/tick` 定时触发密钥（未配置时仅允许已登录管理员访问） |
| `COOKIE_SECURE` | 自动 | 会话 Cookie 是否强制 Secure；HTTPS 反代识别异常时可设为 `1` |

## 🛠️ 本地开发

```bash
npm ci
cp .env.example .env.local
npm run db:migrate
npm run dev
```

常用校验命令：

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## 💾 数据备份

全部状态仅位于挂载的 `data/` 目录（含 `app.db` 与 `uploads/`）。备份只需打包复制该目录，恢复时放回原路径重启容器即可。

## 🧱 技术栈

- **Next.js 16**（App Router · Server Actions）+ React 19 + TypeScript
- **SQLite** + **Drizzle ORM**（`better-sqlite3`，WAL 模式）
- **鉴权**：`bcryptjs` + `jose` JWT Cookie + 内存登录限流
- **图片**：客户端裁剪 + `sharp` 压缩转 WebP 落盘
- **调度**：进程内 `node-cron`（`instrumentation.ts` 启动拉起）
- **样式**：TailwindCSS v4 + Milk Fabric 设计系统 + Framer Motion

## 📄 License

[MIT](LICENSE)
