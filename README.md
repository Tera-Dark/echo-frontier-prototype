# Hunger Protocol · 尸潮纪元：全球猎食

正在开发的**单机尸群增量策略网页游戏**。当前首要目标是完善网页版可玩性，未来以相同 Web 游戏产物封装手机 App。

**仓库：** https://github.com/Tera-Dark/Hunger-Protocol  
**网页版：** https://tera-dark.github.io/Hunger-Protocol/ （以仓库 GitHub Actions 的 Pages 部署链接为准）  
**状态：** 可玩的 Demo，仍需关卡平衡与真机性能验收。

## 当前体验 · Demo 0.5：从一只行尸开始

现在有独立的**开始菜单**，包括「开始新游戏」「继续战役」「巢群研究」「设置」。新档直接进入零号街区，**无需经过第二层开场弹窗**，初始只显示尸能、一个普通行尸的部署卡和精简目标提示。

体验采用渐进解锁：
- **初始：** 只能够部署行尸；其他尸种、资源与研究不占用屏幕。
- **第一次猎食：** 回收生物质，出现生物质资源读数。
- **通关第一关：** 开放尸巢、感染优先策略和脑髓技能；获得迅猎者活性样本，使用生物质**研究**后才能投放。
- **通关第二关：** 开放重尸研究、稀有器官与突变精华。
- **通关第三关：** 开放喷吐者研究。
- **主菜单剧情：** 每个章节附一小段感染巢群视角的叙述，不要求玩家阅读大量剧情。

旧版存档保持原来的 key，读取时会按旧通关进度补齐此前已经解锁的尸种，不强制老玩家重复付费研究。正在进行中的一局可以通过顶栏「☰ 菜单」暂时离开并在同一页面返回；刷新页面后只能从最近记录的战区关卡继续，**不提供战中云存档或实时续局**。

## 操作
**战斗阶段流程：** 进入战场（己方初始零僵尸，平民都在避难所里）→ 选择行尸并亲手点击街道投放 → 绕开巡逻的持枪守卫 → 集结攻破入口路障 → 击毁避难所耐久 → 平民逃出后吞噬/感染 → 完成目标 → 领取奖励并解锁新尸种。

**循序解锁：** 初始仅行尸；通关第 1 关获得迅猎者，第 2 关获得重尸，第 3 关获得喷吐者。现有旧存档的已通关进度会被保留。

- 桌面：拖动地图平移、滚轮缩放；数字 1/2/3/4 选已解锁单位、F 指挥、空格暂停、Esc 取消。
- 手机：单指点按部署/拖动地图，双指缩放；避难所建筑与入口禁止直接部署。
- 首次游玩会出现分步操作指引；顶栏「? 指引」随时重看，存档重置被移入设置以免误触。
- 当前进度仅保存在本机，不自动跨设备同步。

## 目录

| 位置 | 用途 |
| --- | --- |
| index.html / style.css | 全屏战场与 HUD |
| game.js | 当前战斗、地图、寻路、绘制、DOM 交互（后续继续拆分） |
| src/core/storage.js | 安全存档、旧存档迁移与设置偏好 |
| src/core/clock.js | 固定时间步，确保战斗逻辑不依赖显示器刷新率 |
| assets/、manifest.webmanifest、sw.js | 图标与离线 Web 支持 |
| scripts/build.cjs | 构建可独立部署的 dist/ |
| tests/ | 存档/时钟单测和模拟战斗/交互回归 |
| capacitor.config.json | 未来 App 容器配置，尚无原生 Android/iOS 工程 |
| docs/ | 游戏、美术、架构与实机测试标准 |

## 运行

直接使用 Python 静态服务器（不需要依赖安装）：

~~~bash
python -m http.server 8080
~~~

打开 http://localhost:8080 。开发构建需 Node.js 22：

~~~bash
npm install --no-audit --no-fund --package-lock=false
npm test
npm run build
python -m http.server 8080 --directory dist
~~~

GitHub Pages 在 CI 测试成功后**仅部署 dist/**，不会发布测试文件和源码文档。

## 移动 App 迁移

已准备：可独立构建的 Web 产物、核心存档/时间步模块、触控操作、PWA 资源及 Capacitor 配置。**未准备：原生 Android/iOS 工程、安装包、签名、系统返回键处理、真机电量与性能验收。**

后续先从 game.js 中渐进拆出 simulation（战斗/AI）、render（Canvas）、ui（交互）；通过网页版回归后再增加 Capacitor 原生工程，避免一次性重写。

详见 [暮色围城样板关卡](docs/DUSK-SIEGE-VERTICAL-SLICE.md)、[工程架构](docs/ARCHITECTURE.md)、[美术 UI 规范](docs/ART-UI-STANDARDS.md)、[试玩验收清单](docs/PLAYTEST-CHECKLIST.md)、[游戏设计基线](docs/GAME-DESIGN.md)。

## 限制

当前游戏仍是 Canvas 单人原型，无联机、账号、云存档。CI 的 DOM 模拟不等于真实浏览器 GPU 或手机 FPS 验证。
