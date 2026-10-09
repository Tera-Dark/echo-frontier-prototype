# 回响边境 · Echo Frontier

手机竖屏优先、电脑横屏友好的单机塔防网页原型。用于验证「关卡战斗 → 战利品 → 遗物构筑 → Meta 基地 → 更高难度」的长期循环。

## 在线试玩

**https://tera-dark.github.io/echo-frontier-prototype/**

推送到 `main` 后，GitHub Actions 会自动部署到 GitHub Pages。首次启用时可到仓库 **Settings → Pages** 确认 Build and deployment 的 Source 为 **GitHub Actions**。

## 本地运行

直接打开 `index.html` 即可体验；也可运行静态服务器：

```bash
python -m http.server 8080
```

然后打开 `http://localhost:8080`。本项目不需要 Node.js、构建工具、外部 CDN 或 API 密钥。

## 当前功能

- 7×10 路径式建造战场，四类防御设施：脉冲炮、霜蚀塔、裂弧塔、共鸣节点。
- 波次战斗、精英敌人、锚点生命、战场合金和战斗结算。
- 稀有遗物掉落、确定性打造、装备与遗物槽上限。
- 基地 Meta 升级：炮塔校准、后勤储备、遗物矩阵。
- 遗物工坊、敌人图鉴、远征记录与本地存档。
- 手机竖屏单列布局；宽屏横屏采用战场与基地双栏布局。

## 原型范围

当前数值、美术与掉落池均用于实验验证，尚未平衡。存档保存在当前浏览器的 `localStorage` 中，不会自动跨设备同步；清除浏览器数据会删除存档。

设计基线见 [游戏设计文档](docs/GAME-DESIGN.md)，测试步骤见 [试玩验收清单](docs/PLAYTEST-CHECKLIST.md)。
