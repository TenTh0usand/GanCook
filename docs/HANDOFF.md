# GanCook-10k 交接文档（给接手的 Agent / 开发者）

> 最后更新：2026-11-08 · 对应版本：正式环境 `v0.4.0`，开发分支 `feat/prep`（P4，待用户审核）
>
> 读完本文就能接着干。更完整的过程记录（每次改动、截图、决策原话）在用户的 Obsidian 单文件手册里（见 §2）。

---

## 1. 这是什么

- **项目**：「干饭厨子 GanCook」—— 家庭点菜 / 做饭协作小程序（Next.js + SQLite，单容器，部署在家里的 NAS 上）。
- **本仓库**：用户的 fork `https://github.com/TenTh0usand/GanCook`，在原作者 `https://github.com/Gloridust/GanCook`（MIT）基础上做二次开发，代号 **GanCook-10k**。
- **二次开发方向**：把「谁为这顿饭出了力」扩展为 备菜 / 做菜 / 点菜 / 善后 四种角色；奈雪式点菜菜单；简易 / 科学双评分；备菜记录；（规划中）外出探店、花费统计、菜价库。
- **和上游的关系**：已加入自有数据库迁移（0001–0004），**不再整体合并上游**；上游有需要的修复用 `cherry-pick` 单独挑。

## 2. 用户与协作方式（务必遵守）

| 项 | 说明 |
| :--- | :--- |
| 用户 | 自称「小白」，中文沟通；需要讲清楚原因和操作步骤 |
| 文档要求 | **每次修改 / 阶段进展都写进一个单文件 Markdown**：`E:\Apps\Obsidian\10kRevolution\10kRevolution\Home\4 Dev\Nas\Gacook\GanCook 开发与管理手册.md`（Obsidian 库，注意 Obsidian 兼容：callout、mermaid、相对路径图片）。图片附件放同目录 `assets/` |
| 审核流程 | 功能在分支上做完 → 部署到**开发环境 :4257** 给用户看 → 用户说「继续 / 没问题」才合并 main、打标签、部署**正式环境 :4258**、推 GitHub |
| 最高设计原则 | **轻量、自由、少报错**：能不填就不填（通常只有名称必填）、能自动就自动、不弹阻断式报错（不合法输入自动修正）、不强制流程 |
| 审美 | 沿用原项目「牛奶布艺 Milk Fabric」：白卡片 + 发丝描边 + 大圆角 + 青菜绿；新增的角色色**只用于角色语义** |
| 语言 | 新功能**中英双语**都要补（`lib/i18n/dictionaries.ts`） |

## 3. 环境与访问

| 项 | 值 |
| :--- | :--- |
| NAS | 绿联 DXP4800（UGOS Pro，Debian 12），`192.168.0.115`，SSH 用户 `10k`（**密码向用户索取，不写进仓库**），有 sudo |
| UGOS 网页 | `http://192.168.0.115:9999` |
| 开发环境 | `http://192.168.0.115:4257`，目录 `/volume1/dev/GanCook`，PM2 进程 `gancook-dev`（`next dev`），开发库 `data/app.db`（测试数据） |
| 正式环境 | `http://192.168.0.115:4258`，目录 `/volume1/dev/GanCook-prod`（`docker-compose.yml`、`data/` 真实数据、`backups/`），容器 `gancook-prod`，镜像 `gancook-custom:latest`（上一版 `:prev`） |
| Node | 独立安装的 Node 22：`/volume1/dev/.tools/node22`（系统自带 Node 18 别动）；`~/.bashrc` 已配置 PATH |
| 代理 | NAS 走本机 mihomo `127.0.0.1:7890`（已写入 `~/.bashrc`）；Windows 电脑走混合端口 `7897` |
| npm 源 | `https://registry.npmmirror.com`（官方源在 NAS 上超时） |
| GitHub 推送 | NAS 公钥未加到 GitHub → **经 Windows 电脑中转**：`d:\AI\antigravity\GanCook`（只做推送，不在这里改代码；脚本见 §9） |

> ⚠️ **UGOS 会自动关闭 SSH**：连不上 22 端口时（网页、4257、4258 都正常），让用户去 UGOS 网页 → 控制面板 → 终端机 重新打开 SSH。

## 4. 日常命令（NAS 上，`cd /volume1/dev/GanCook`）

| 命令 | 作用 |
| :--- | :--- |
| `./manage.sh status` | Git / 开发 / 正式 / 备份状态 |
| `./manage.sh save "说明"` | git add + commit |
| `./manage.sh deploy` | **备份正式数据 → NAS 上 `next build` → 打轻量镜像（旧镜像存 `:prev`）→ 重启 4258 → 自检**，约 2 分钟 |
| `./manage.sh rollback-prod` | 正式环境回到上一个镜像（数据不动） |
| `./manage.sh backup` | 只备份正式数据到 `GanCook-prod/backups/` |
| `./manage.sh dev-restart` / `dev-logs` | 开发服务器 |
| `npx drizzle-kit generate --name xxx` | 改 schema 后生成迁移（`drizzle/000N_xxx.sql`），可在末尾追加数据迁移 SQL（用 `--> statement-breakpoint` 分隔） |
| `npm run db:migrate` | 对开发库应用迁移（正式环境容器启动时自动迁移） |
| `npx tsc --noEmit -p .` | 类型检查（ESLint 在本项目跑不起来，见 §8） |
| `node scripts-dev/seed-test.cjs` | **重置开发库测试数据**（3 个测试账号、19 道菜、40 天历史、评分、备菜） |
| `node scripts-dev/dev-token.cjs 妈妈` | 生成开发环境登录 cookie（`gancook_session=...`），给自动化测试用 |

`manage.sh`、`scripts-dev/` 不进 Git（`.git/info/exclude`），副本在备份目录（§10）。

**标准开发流程**：`git switch -c feat/xxx` → 改代码（含迁移）→ 开发库验证 → `tsc` + `next build` → commit → 给用户审核 → `git switch main && git merge --ff-only feat/xxx && git tag -a vX.Y.Z` → `./manage.sh deploy` → Windows 中转推 GitHub → 更新 Obsidian 手册 Changelog。

## 5. 技术栈与目录

Next.js 16（App Router、Server Actions、Turbopack）+ React 19 + TypeScript；SQLite + Drizzle ORM（better-sqlite3）；TailwindCSS v4；framer-motion；lucide-react；sharp（图片转 WebP 落盘）；node-cron（进程内调度）。

GanCook-10k 新增 / 改动的关键文件：

| 文件 | 作用 |
| :--- | :--- |
| `lib/roles.ts` | 纯常量：餐次 `MEAL_TYPES`（早/午/晚/加餐/夜宵）、`MEAL_EMOJI`、角色 `CONTRIB_KINDS`、角色色 `ROLE_META`、`guessMealType()`（按时间猜餐次） |
| `lib/duties.ts` + `lib/actions/duties.ts` | 餐次分工 `meal_roles` 读写；`toggleMyRole` **只能改自己** |
| `lib/contributions.ts` | 统计页四角色热力图数据（备菜 / 善后按每人每天去重） |
| `lib/menu-config.ts` | 纯常量 + 类型：菜单定义 `MENUS`（家常 / 完整）、收录阈值、客户端数据类型 |
| `lib/menus.ts` | 做过次数、菜单分组排序、本季推荐、`getMenuBrowserData()` |
| `lib/scoring.ts` | 评分维度 `SCORE_DIMS`、分数工具；**综合分算法待定，只改 `overallFromDims()`** |
| `lib/prep.ts` + `lib/actions/prep.ts` | 备菜记录查询 / 保存（写记录自动打「备菜」） |
| `lib/actions/menu-admin.ts` | 管理员：分类管理、本季推荐管理 |
| `components/menu/menu-browser.tsx` | 奈雪式菜单组件（搜索 / 海报 / 吸顶菜单切换 / 左侧导航滚动联动 / 两列卡片），管理与点菜两种模式 |
| `components/menu/order-menu.tsx` + `app/(app)/meals/[id]/order` | 全屏点菜页 |
| `components/ui/half-stars.tsx`、`radar-chart.tsx` | 半星评分输入、六边形雷达图（手写 SVG） |
| `app/(app)/stats`（`/wall` 跳转到这）、`app/(app)/prep` | 统计页、备菜页 |
| `Dockerfile.prebuilt` + `.dockerignore` | 快速部署镜像（拷贝宿主机构建产物；**必须排除 `.next/standalone/data` 开发库**） |
| `app/globals.css` | 新增 `--mf-role-*` 角色色变量（含暗色） |

## 6. 数据模型（新增部分）

| 迁移 | 内容 |
| :--- | :--- |
| `0000` | 原项目：users / dishes / meals / orders / reviews / meal_schedules / settings |
| `0001_meal_roles` | `meal_roles`：(user, date, slot, kind=prep/cook/clean) 唯一；`meal_id` 可空（有在家饭局时自动关联）；`source` manual/meal/prep_log；迁移时把原 `meals.cook_id` 搬入。**`meals.cook_id` 仍保留并自动同步为第一个做菜的人** |
| `0002_menu` | `dish_categories`（预置 7 大类 + 12 细类，parent_id 空 = 大类，`other` 固定且不可删）、`dish_cook_logs`（手动「我做过」）、`menu_features`（本季推荐）；`dishes` 加 `category` / `subcategory` / `pinned`；按标签和菜名自动猜大类 |
| `0003_scoring` | `reviews` 加 `score_x10`（分数 ×10 整数）、`mode`（simple/sci）、`dims`（六维 JSON）；`rating` 保留同步 |
| `0004_prep` | `prep_logs`（user, date, slot, note, image）+ `prep_items`（name, source bought/fridge/other, qty 自由文字, price_cents） |

约定：时间 unix 秒；日期 `YYYY-MM-DD`（家庭时区）；金额存「分」；分数存 ×10；**只加不删字段**；SQLite 的 text 枚举没有 CHECK 约束，扩展枚举不用迁移。

## 7. 已上线功能与规则（口径）

| 期 | 版本 | 内容 |
| :--- | :--- | :--- |
| P1 | `v0.2.0` | 四色角色（备菜橙 `#e3954a` / 做菜绿 `#4ea96b` / 点菜紫 `#9a7fc8` / 善后蓝 `#4a9ccf`；外出粉 `#d9779a` 预留）；按**餐次**打卡（「我的」+ 饭局详情「这顿的分工」）；一餐可多人做菜（「我也来做」）；「贡献」→「统计」：四张独立热力图，**默认隐藏备菜、善后**（设备记忆）；备菜 / 善后统计按**每人每天**（干过一次就算），做菜按餐次，点菜按饭局；底部 6 Tab；餐次加「加餐 / 夜宵」 |
| — | `v0.2.1` | 快速部署（30 分钟 → 约 2 分钟） |
| P2 | `v0.3.0` | 菜品分类（大类 + 细类）；做过次数 = 已完成饭局（一顿只算 1 次）+ 手动「我做过」；**家常菜单** = 家常精选 + 最近 3 个月做过 ≥2 次（为空时显示全部并提示）；**完整菜单** = 全部（大类内按细类分组）；本季推荐 = 管理员指定，否则最近 3 个月做得最多；奈雪式布局（左侧一列导航点击跳转 + 滚动联动、两列卡片、时令海报）；全屏点菜页 `/meals/[id]/order`；家庭管理：本季推荐管理、分类管理（删分类不删菜） |
| P3 | `v0.4.0` | 评分：简易（半星 / 输入 1.0–5.0，默认）+ 科学（味道 / 口感 / 卖相 / 份量 / 性价比 / 体验，雷达图，综合分暂取平均可手动改）；饭局卡片显示全家平均分 |
| P4 | `feat/prep`（**待审核**） | 备菜页：日期切换、概览（参与人、当天 / 本周花费）、记录（来源 买的/冰箱/其他、数量、价格、处理方式、照片）；写记录自动打「备菜」，删记录时自动打的一并取消 |

**权限**：家务打卡只能标记自己；菜品由添加者 / 管理员编辑，其他人只读但可记「我做过」；「我做过」记录本人 / 管理员可删；备菜记录本人 / 管理员可改；家庭管理仅管理员。

## 8. 待办 / 路线图

| 优先级 | 事项 | 设计要点（详见 Obsidian 手册 §6） |
| :--- | :--- | :--- |
| 下一步 | **P4 审核 → 发布 `v0.5.0`** | 合并 `feat/prep`、deploy、推 GitHub |
| P5 | 外出 / 探店 + 统计页「外出足迹」「花费」 | `meals.kind`（home/out）、外出分类（正餐/饮品/甜点/小吃）、状态 想去→去过了（调度器不碰外出）、`venues` 店铺、`meal_items` 单品（简易分）、`meal_companions` 同行；金额：总价 + 人数（自动人均）+ 我家实付（默认 = 总价）；外出**不计入点菜贡献**，另设「外出就餐」指标且**默认不显示**；统计页三段：家务贡献 / 外出足迹（莓果粉热力图、本月次数 / 实付 / 人均、分类占比、常去的店、可筛选记录）/ 花费（按周 / 月柱状图：外出实付 + 在家买菜，周一开始）；饭局页外出筛选上方一行本月摘要 |
| P6 | 菜价库 | 「不给牛排一个价，给哪种牛排一个价」：`ingredients` + `price_records`（规格 / 品牌 / 渠道 / 店名 / 档次 ¥~¥¥¥ / 新鲜度 / 数量单位 → 自动换算每斤单价）；只显示价格区间；备菜填价格时可展开写入（不用记两遍） |
| 需求池 | 菜单分享 / 导出导入（社区反馈） | P2 已完成，可随时插队 |
| 需求池 | 冰箱库存（备菜买进 / 用掉增减）、自动生成买菜清单、消息推送（Bark / Telegram / 飞书） | — |
| 待定 | 科学评分综合分算法 | 只改 `lib/scoring.ts` 的 `overallFromDims()` |
| 技术债 | ESLint 配置在 ESLint 9 下崩溃（原项目问题，`Converting circular structure to JSON`） | 目前以 `tsc` + `next build` 把关 |

## 9. 自动化测试与工具（Windows 端）

- 工具目录：`d:\AI\antigravity\GanCook-tools\`（**含 NAS 密码，不进 Git**），里面有 `README.md`：
  - `nas_exec.py`（远程执行命令，`--file` 执行脚本文件，避免 PowerShell 引号问题）
  - `sync_to_nas.py`（把本地改好的文件经 tar over SSH 同步到 NAS；SFTP 在 UGOS 上不可用）
  - `push_github.py`（NAS 打包 → Windows 中转仓库 → 经 7897 推 GitHub）
  - `tests/interact_*.py`（Playwright + 本机 Edge，手机尺寸 390×844，对开发环境做交互测试并截图；运行前 `$env:PYTHONIOENCODING='utf-8'`）
- 测试账号（仅开发库）：老爸（管理员）/ 妈妈 / 小明，密码 `123456`。

## 10. 备份位置（2026-11-08 大型备份）

- NAS：`/volume1/dev/backups/2026-11-08_handoff/` —— 全部分支和标签的 `git bundle`、正式数据备份、开发库、`manage.sh`、正式 compose、`scripts-dev/`、工具脚本、Obsidian 手册副本
- 正式数据每次部署前自动备份：`/volume1/dev/GanCook-prod/backups/`
- GitHub：`main` + 所有标签 + 进行中的分支

## 11. 踩坑记录

- PowerShell：命令里的 `$` 会被展开、`[id]` 路径会被当通配符（用 `-LiteralPath`）、控制台 GBK 打不出 `¥`；复杂命令一律写成脚本文件再 `nas_exec.py --file`。
- 第一次写 `~/.bashrc` 时引号错了，导致 UGOS 的 SSH force_command 直接拒绝登录；改 `.bashrc` 要格外小心（必要时用 heredoc 整体重写）。
- 在镜像里完整构建会跑 30 分钟且可能因内存失败 → 已改为宿主机构建 + `Dockerfile.prebuilt`；构建产物 `.next/standalone/data` 会带上**开发库**，已用专用 dockerignore 排除。
- Next 16 开发服务器输出在 `.next/dev`，可与 `next build` 同时存在，不冲突。
- 调度器会把用餐时间过去 4 小时的饭局自动标为已完成 → 测试数据的「点菜中」饭局要放在明天。
- 开发模式刚编译完的首次访问偶发 hydration 提示，重复访问消失，生产构建无此问题。
- UGOS 会自动关闭 SSH（见 §3）。

## 12. 版本历史

| 标签 | 内容 |
| :--- | :--- |
| `v0.1.0-baseline` | 克隆时的原版 |
| `v0.2.0` | P1 角色 / 家务 / 统计 |
| `v0.2.1` | 快速部署 |
| `v0.3.0` | P2 菜单 / 点菜页改版 |
| `v0.4.0` | P3 双评分 |
| （待发布）`v0.5.0` | P4 备菜页 |
