# HorizonMobile

Horizon 生态的 Android App（深空矩阵新视野）。底座迁移自 AEMobileApp（原仓库保留于个人账号）。

## 当前状态（协议栈 + App 面就位）

- `src/net/`：**现役协议栈**（契约 1.5.x）——帧编解码（len 含 type+flags，残留切 4+len）、
  HORIZON HMAC（noble）、HorizonConn 多路复用（单数据泵+单飞重连）、preauth 预鉴权层、
  RnTransport（react-native-tcp-socket）/ NodeTransport（测试）双传输。
- `src/ui/`：**App 面**（Expo 51 / RN 0.74.3）——NativeStack 六路由 + AppContext；
  屏幕：Login/Team/TeamOps/TeamRoster（契约 team 域 15 op 全量）/Chat（公开+私聊+好友+屏蔽）/
  Monitor（metrics.network 5s 轮询 + rank.sync）/Session（会话列表与撤销）/Me（me.list/share/unshare）/
  Bind/Settings/About；theme.ts 统一调色板。
- `mock/`：契约 mock 后端（订阅流/chat 域/ME 域），`test/e2e.ts` 14 场景 + `test/cross-lang.ts`
  跨语言探针（对真后端 JAR 实测）。
- `src-app-legacy/`：旧底座参照（含归档入口 AppEntry.legacy.tsx）。

## 测试与验收

```
npm install          # expo 51 基线（node20）
npm run typecheck    # tsc --noEmit（含 .tsx 与 App.tsx）
npm test             # tsc(tsconfig.test) + 单测 6 + e2e 14 场景
node dist-test/test/cross-lang.js 44544   # 对真后端的跨语言探针（后端在跑时）
```

## 环境与账号

- 后端部署/端口/铸码：见工作区 `测试环境.md`「Horizon 实际部署状态」。
- 登录屏预填上次地址（AsyncStorage）；无绑定时按流程输入游戏内 `/dsmnhmobile bind` 绑定码。
- rankings.apply 落地目标为待决策项（SU 榜只读），见工作区 `测试待办.md`。

## 构建与发版

- Expo Go / dev-client 可直接跑（app.config.js：com.dsmnh.mobile.app，Horizon 0.1.0 新线）。
- 原生构建与签名属人类操作（夜班纪律禁 keystore），EAS projectId 沿自底座待人工确认。
