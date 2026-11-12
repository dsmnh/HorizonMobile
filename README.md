# HorizonMobile

Horizon 生态的 Android App（深空矩阵新视野）。底座迁移自 AEMobileApp（原仓库保留于个人账号）。

## 当前状态（契约 1.6.0 协议栈 + App 面）

- `src/net/`：帧编解码（len 含 type+flags，残留切 4+len）、HORIZON HMAC（noble）、
  HorizonConn 多路复用（单数据泵 + 单飞重连）、预鉴权层、可选 TLS 与 `flags 0x02` 逐帧绑定、
  证书指纹固定；RnTransport（react-native-tcp-socket）与 NodeTransport（测试）双传输。
- `src/ui/`：Expo 51 / RN 0.74.3，NativeStack 六路由 + AppContext。
  登录屏含注册/登录/恢复码重设密码；队伍屏覆盖契约 team 域 15 个 op（含 `team.invite`）；
  聊天屏含公开/私聊/好友/屏蔽；监控屏含 `metrics.network`、`rank.sync`（带 `uuid`）与
  `admin.opSet`；ME 屏含 `me.list/share/unshare` 与 `me.query` 轮询；BQ 屏覆盖同步前二次确认并
  显示来源/目标服；会话屏、绑定屏、设置屏（含 `account.uuids` 与证书信任重置）、关于屏齐备。
- `mock/`：契约 mock 后端；`test/e2e.ts` 17 场景（20 项断言）覆盖握手、订阅流、重连、
  聊天/队伍/ME/榜单域、TLS 绑定与降级剥离、指纹固定；`test/cross-lang.ts` 为对真后端的跨语言探针。
- `src-app-legacy/`：旧底座参照（含归档入口 AppEntry.legacy.tsx）。

## 测试与验收

```
npm install          # expo 51 基线
npm run typecheck    # tsc --noEmit（含 .tsx 与 App.tsx）
npm test             # tsc(tsconfig.test) + 单测 8 + e2e 17 场景（20 项断言）
node dist-test/test/cross-lang.js <App 平面端口>   # 真后端运行时执行跨语言探针
```

`dist-test/` 为测试编译产物，不进仓库；`npm test` 自动重建。

## 环境与账号

- 一个 Horizon 网络对应一个后端；登录屏填写后端地址与端口，并预填上次成功连接的地址。
- 无绑定身份时，在游戏内执行 `/dsmnhmobile bind` 取得绑定码后于绑定屏输入。
- App 平面默认 TLS，证书指纹按首次连接信任（TOFU）固定：首次连接记录服务端指纹，之后不一致
  即断开且不自动重连；换证书或换后端时在设置页「重置已信任证书」。详见协议契约 §9.1。
- `rankings.apply` 的落地目标为待复核项（SU 排行榜只读），当前写入 vanilla scoreboard 侧栏。

## 构建与发版

- Expo Go / dev-client 可直接运行（`app.config.js`：包名 `com.dsmnh.mobile.app`，版本 0.1.0）。
- 原生构建、签名与渠道发布由维护者执行；EAS projectId 沿自底座，发布前需人工确认。
