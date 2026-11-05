# AI 协作指南（AEMobileApp）

> 给在本仓库工作的 AI（和未来接手的人）看的上下文与守则。程序结构详见同目录 `程序结构.md`。

> **收尾必做**：按 `../../AGENTS.md` §0 删一轮已完成的内容 —— TODO 里打勾的、已解决的问题、
> 只剩历史价值的沿革，都删掉。本文件上限 400 行，超了先合并同类项；一个事实只写一处。

## 一句话背景

React Native/Expo 手机端：连 AEMobile mod 的 44444 端口，远程监控 GTNH 服务器的 AE2 网络。2026-10 完成 UI 全面重构（暗色主题、五 Tab、自研组件，无 UI 框架依赖）。2.0.3 增加服务端数据落盘缓存并把设置页拆成「分组列表 + 子页」，2.0.4 增加多账号（连接预设）与可配置的在线线路列表。2.1.0 改网络层：token + HMAC 签名、增量帧、MSPT 移除。3.2.0 聊天页，3.3.0 Telegram 式聊天 + 头像 + 进出提示 + 绑定码重置 + 音乐点歌面板。

**3.0.0（2026-10-27）把 HTTP/SSE 换成裸 TCP**（`src/net/`）：一条连接多路复用、连接层统一重连、
帧格式与 2.1.0 的 SSE 帧完全一致（`frames.ts` 没改）。原因是服务端被阿里云按 `Host` 头拦截，裸 TCP 不受影响。

## 五仓库关系（接口是多方契约）

```
AEMobile（Java mod，服务端+协议源头）←— 裸 TCP 自定义帧 —→ AEMobileApp（本仓库）
        │
        └─ App 音乐/代理命令 → AEMobileBridge（BC 通用命令桥）→ AllMusic 等代理插件

AEMobileIcoOutput（图标库维护包）
AEMobileDesktop（不开发，见其 doc/）
AEMonitor-Frontend（WebUI 子模块，mod 侧 3.0.0 起不再打包）
```

- 本仓库消费的 op 名字、DTO 字段名，以 `../AEMobile/doc/程序结构.md` 的「TCP 接口一览」为准；本地 mock（`mock/server.mjs`）就是按它实现的。
- 协议契约在 `../../AEMobile/doc/传输协议与安全.md`（帧格式 / 握手 / 鉴权 / 订阅）。**改网络代码前必读。**
- 参考游戏实例：`D:\Game\Minecraft\MMCproject\instances\GTNH290TEST`（GTNH 2.9.0 + TST 0.8.0-RC2.9）。
  图标库 2026-11-02 用该实例 `/aemobileicons dump all` 重建：manifest 49321 条 → items 61825 行 / 191.6MB，
  fluids 1286 行，essentia 80 条。路径与启动方式以仓库根 `AGENTS.md` §2/§3 为准。

## 版本号规则（MAJOR.MINOR.PATCH，当前 3.6.0）

- **单个项目单独更新**：改最后一位（PATCH），如 2.0.0 → 2.0.1。
- **多个项目统一更新**（接口联动改动后 mod / App / Desktop 一起发版）：改中间一位（MINOR），如 2.0.x → 2.1.0。
- 第一位（MAJOR）留给大版本：不兼容的协议重构或整体换代。
- 版本号需要改的位置：`package.json` 和 `app.config.js` 两处必须一起改（iOS 发包还要同步递增 `buildNumber`）。三个项目的版本号应保持一致。

## 提交规范

中文 Conventional Commits，**书面语**，不写口语和网络用语。

```
<type>(<scope>): <简述>

<正文：改了什么、为什么>
<实测：怎么验的、结果如何>
```

- `type`：`feat` / `fix` / `docs` / `chore` / `refactor` / `test` / `build` / `perf` / `style`。
  没有合适的类型时先想清楚改动性质，不要将 `chore` 作为缺省选择。
- `scope` 用模块名：`chat` / `settings` / `android` / `zhdict` / `asset` / `splash` / `music` / `bridge`。
- 简述不超过 50 字，不加句号，不加 emoji，不写「更新」「优化」这类无信息量的词。
- 正文写**原因与影响**，不写过程；有实测就写结果，没验证要写明。
- 一个可独立说明的改动一个提交，不把无关改动混在一起。

**语气**（2026-11-01 对全部历史提交统一改写，之后沿用右列）：

| 不写 | 改写成 |
|---|---|
| 丢掉 / 抹掉 / 收口 | 移除 / 覆盖 / 收敛 |
| 告诉 App / 让手机端知道 | 下发 / 供手机端判断 |
| 换成自己的 | 改用自有 |
| 不再刷屏 / 不再给空入口 | 避免重复提示 / 不显示空入口 |
| 那条 / 我们自己那条 | 该条 / 本模组下发的 |
| 一眼能看出 / 看着像没做 | 可直接确认 / 表现为未生效 |
| 发糊 / 被踢 / 抓包 | 模糊 / 断开连接 / 捕获 |

- 动作要明确：谁做了什么、影响到哪里；主语按中文习惯可省略。
- 引用代码用反引号，路径用相对仓库根的路径。
- **push 一律由仓库所有者执行**，AI 只在被明确要求时推。
- 历史提交需要整体改写时用 `git filter-branch --msg-filter` + 仓库根 `tools/rewrite_msg.py`
  的映射表；注意 Windows 下传入的消息带 CR，脚本里要先做 CRLF→LF 归一，
  且映射的 key 必须是**当前**标题。

## 本机开发环境（2026-10 由 AI 搭建）

- **Node 20 便携版**：`D:\Library\DevelopmentKit\nodejs20\node-v20.18.1-win-x64`（不在系统 PATH，命令前手动 export PATH）。包管理用 npm（package-lock.json）。
- **JDK**：RN 构建用 `D:/Library/DevelopmentKit/Java/Zulu/zulu17`（JAVA_HOME）。
- **Android SDK**：`D:/Library/DevelopmentKit/AndroidSDK`（已补 CMake 3.22.1 + ninja，见下）。
- **Gradle 全局国内镜像**：`C:\Users\huaxi\.gradle\init.d\mirrors.gradle`（阿里云镜像插到所有项目仓库最前，对所有构建生效）。删除它则 dl.google.com 相关依赖解析会失败。
- **MuMu 模拟器**：adb 端口 5555（`adb connect 127.0.0.1:5555`，2026-10-28 起用这个；旧笔记里的 16384 是旧实例）。测试服务器 = mock（宿主机）。

### 本机路径速查（2026-10-29 核对）

| 是什么 | 路径 |
|---|---|
| 工作根目录 | `D:\Develop\Game\AEMobildAll` |
| App 仓库（本仓库） | `D:\Develop\Game\AEMobildAll\AEMobileApp` |
| mod 仓库（服务端 + 客户端同一个 jar） | `D:\Develop\Game\AEMobildAll\AEMobile` |
| 图标库维护包 | `D:\Develop\Game\AEMobildAll\AEMobileIcoOutput` |
| 建库脚本主副本 | `D:\Develop\Game\AEMobildAll\tools` |
| 代理桥仓库 | `D:\Develop\Game\AEMobildAll\AEMobileBridge` |
| 图标库本地副本（**不进 git**） | `D:\Develop\Game\AEMobildAll\iconpack` |
| 在线更新包输出 | `D:\Develop\Game\update\dsmgtnhupdate\ae` |
| **游戏客户端**（MultiMC 实例） | `D:\Game\Minecraft\MMCproject\instances\GTNHRC2\.minecraft` |
| **服务端**（Thermos 1.7.10） | `D:\Game\Minecraft\Server\GTNH290RC2` |
| BungeeCord 代理 | `D:\Game\Minecraft\Server\BC` |
| **模拟器** | MuMu，`adb connect 127.0.0.1:5555`；包名 `dev.youtiao.aemonitor` |

游戏客户端里的几个具体位置：

```
<实例>\.minecraft\mods\aemobile-1.7.10-3.3.0.jar      mod（客户端侧命令 + debug 命令桥）
<实例>\.minecraft\config\AEMobile.cfg                 [debug] enabled 决定命令桥是否启动
<实例>\.minecraft\dumps\aemobile\                     /aemobileicons dump 的产物（items/ + *.tsv + atlas.raw）
<实例>\.minecraft\dumps\aemobile\cmd-client.txt       写一行命令 → 客户端下一个 tick 执行
<实例>\.minecraft\GregTech_zh_CN.lang                 流体中文名来源（建库要用）
```

设备上的库文件（`adb root` 后可读）：

```
/data/data/dev.youtiao.aemonitor/files/SQLite/{items,fluids,essentia}.db
```

判断「换了库没生效」先比 sha：`adb shell sha256sum /data/data/<pkg>/files/SQLite/*.db` 与
`AEMobileApp/assets/*.db` 对照。

## 本仓库特有的已知问题（AI 开发时易触发）

1. **MuMu 的 adbd 无法承受 reverse 隧道**：`adb reverse` 转发 bundle 大流量会使 adbd 失去响应（触摸失效 → shell 无响应 → 只能重启模拟器）。**用 NAT 直连**：Metro 加 `--host lan`，模拟器内宿主机是 `10.0.2.2`，App 设置里地址填 10.0.2.2。adb 只用来截图/点击/安装。
2. **Metro 不要用 CI=1 启动**：会禁用 watch 和 reload，改代码永远不生效。改完用 `curl -X POST http://localhost:8081/reload`。Metro 残留 node 进程占 8081 时 `netstat -ano | grep 8081` 找 PID 强制结束进程。
3. **node_modules 里有两处本地补丁**（npm ci 后需重新应用，都是 compileSdk 35 兼容）：
   `expo-modules-core/.../PermissionsService.kt` 的 `requestedPermissions?.contains(...) ?: false`；
   `expo-sqlite/android/build.gradle` 的 android{} 里注入 `ndkVersion`。
4. **android/build.gradle 有环境补丁**：NDK 锁本机 27.2、compileSdk 35、subprojects 强制注入 ndkVersion、阿里云镜像。不要将其清理。
5. **echarts 必须用 SVGRenderer + SvgChart**（SkiaRenderer 在此环境报 install of undefined 白屏），因此 **react-native-svg 不能移除**。同时 echarts 绝不能进启动路径（`navigation.tsx` 用 `React.lazy` 懒加载 MonitorScreen）。
6. **app 冷启动后 adb 连接可能断开**：模拟器负载会使 adbd 失去响应，重连 `adb connect 127.0.0.1:5555`；无法连接时执行 `MuMuManager.exe control -v 0 restart`（工具在 `C://Program Files\NetEase\MuMu\nx_main\`）。每条命令结束后 adb server 也常被回收，调 UI 时用后台任务保活，**不要每轮重复 `adb reverse`**。
7. **Windows 防火墙**会弹 node 授权框（Metro/Mock 监听端口），选择"允许"。
8. **在线图标库**：清单是 schema 2（`items` / `fluids` / `essentia` 各一段），App 只比 `sha256`，只下有变化的那一个。改了库必须让 `src/bundled.ts` 的 sha 同步更新（`embed_pack.py` 会写），否则装完新包还提示"有更新"。更新源在「设置 → 图标库」可改，存 SecureStore `icons.manifest_url`。
9. **JSX 换行不要省略**：`<View style={...}>      <Text>` 写在同一行时，中间的空格会变成 View 的文本子节点 → 红屏 `Text strings must be rendered within a <Text> component`，报错栈不包含行号。
10. **缓存文件名不能用缓存键原文**：键里有 `://`、`#`、`/`，编码后写文件仍会被解码成路径分隔符，写入静默失败。现在用 `<分类>-<FNV1a 8 位>.json`。
11. **expo-secure-store 没有同步删除**：只有 `deleteItemAsync`，删除后立刻 `getItem` 会读到旧值。需要"删了马上生效"就改写成写入默认值，或加进程内镜像（见 `iconpack.ts`）。
13. **MuMu NAT 直连 10.0.2.2 连接不稳定**：先 `curl http://127.0.0.1:8081/status` 确认 Metro 是否在运行，再判断是否为网络问题。
14. **SecureStore 单值 2048 字节**：多账号不能写入一个 key。现在是 `accounts.index` 存 id 数组、每账号一个 `account.<id>`。
15. **根导航的 Setup/Main 用 `enteredRef` 锁住**：只看 `complete` 的话，主界面里切到未配好的账号会把整棵树回退到 Setup。`ServerSettingsScreen` 判断"是不是首次配置"要用 `navigation.canGoBack()`。
16. **在线线路列表**：`ae/servers.json`（Gitea `dsmgtnhupdate`），同 `host:port` 会覆盖内置线路名；地址存 SecureStore `servers.list_url`。
17. **启动白屏的三个来源**：① `colors.xml` 的 `splashscreen_background`（改完要重新构建 APK）；② `SQLiteProvider` 加载期间渲染 `null`，靠 `BootOverlay` 覆盖；③ dev-client 自己的白色启动页（release 包没有）。
18. **状态栏不要用默认 translucent**：`expo-status-bar` 在 Android 默认透明，内容会绘制到状态栏下面。现在 `translucent={false}` + 各屏 `useSafeAreaInsets().top` 双重保障。
19. **release 包要另外构建**：`cd android && ./gradlew assembleRelease`。**签名读仓库根的
    `keystore.properties`（gitignored），keystore 在仓库外** —— 2026-11-01 之前用的是公开的
    `debug.keystore`，任何人都可签出同名更新，已更换。详见下面第 25 条。dev client 冷启动要等
    Metro 打包，感觉"启动耗时很长"多半是这个。
20. **三个库都不进 git**（`/assets/*.db` 已忽略）。`src/bundled.ts` 引用它们，所以**新克隆的仓库直接 `assembleRelease` 会失败**；要公开发布就先执行 `embed_pack.py --restore` 把 `bundled.ts` 置空再提交。
21. **聊天帧现在是 9 位**（2026-11-01）：`[seq,kind,name,text,ts,srv,att,team,teamColor]`。
    `teamColor` 是一个码字符（`d` / `b`），用 `chatview.tsx` 的 `MC_COLORS` 表转十六进制；
    空串表示没有队伍，这时回落到 `colorForName` 的哈希色。**MC 的纯黑/深蓝在暗色主题下不可见**，
    所以表里的色值统一往中亮度提升了一档。
22. **队伍色要落库**：`chatlog.ts` 的 `msg` 表有 `team_color` 列（`migrate()` 里 ALTER 补列），
    否则 App 重启后历史消息的名字颜色会全部退回哈希色。
23. **正文为空时文案在本地出**：`attHint(att)` 按附件类型返回「分享了物品 / 任务 / 物品和任务」。
    服务端只发结构化数据，不发文案也不翻译（见 AGENTS.md 的约定）。
24. **`NativeDatabase.initAsync has been rejected`**：`force-stop` 后立刻 `am start` 会触发
    「Access to closed resource」（旧句柄没释放）。等 5 秒再启动，或 `pm clear`（会丢失配置）。
25. **APK 签名是「用户能不能覆盖安装」的唯一开关**（2026-11-01 换成自己的 key）：
    - keystore `D:\Develop\Game\keys\aemobile-release.jks`（仓库外），口令在
      仓库根 `keystore.properties`（**gitignored**）；两者丢失其一即无法再发布覆盖更新，**备份**。
    - 签名一变，已装用户**必须卸载重装**（`INSTALL_FAILED_UPDATE_INCOMPATIBLE`），
      代价是图标库（重新下载 ~186MB）、绑定码（游戏里 `/aemobile token reset`）、聊天记录全部丢失。
    - 不要再执行 `expo prebuild --clean`（会重建 `android/`）；确需执行时，完成后确认
      `git status` 中签名配置未被删除。
    - 自检：`keytool -printcert -jarfile app-release.apk | grep SHA256`，
      当前证书 `5C:DF:77:83:93:4F:D6:20:...`。
    - 构建日志里出现「没有 keystore.properties，本次用 debug 签名」= 这个包装不上，不要发布。
26. **中文名全是本地查表，字典过期就「没汉化」**（2026-11-01 已两次遇到）：
    - 数据在 `src/zhdictdata.ts`，由 `tools/gen_zhdict.py` 生成，**不要手动修改**。
    - **中文来源有三处**，缺一处就整块是英文：① 汉化包（`nightly-*`）；② 客户端的
      `GregTech_zh_CN.lang`；③ **客户端 `mods/*.jar` 自带的 `assets/*/lang/zh_CN.lang`**。
      第 ③ 条是 2026-11-02 补的：汉化包只覆盖它收录过的模组，TST（TwistSpaceTechnology）
      这种新模组自带 552 条中英对照，不读它就永远是英文名（NEI 分享到手机上也是英文）。
      合并顺序是「汉化包优先、jar 自带只补空缺」，不会覆盖汉化包的译法。
    - **上游没翻的条目要单独补**：TST 有 30 条中英完全相同（作者直接沿用英文），
      脚本会把它们当「未翻译」跳过，再在 `tools/data/*-extra.lang` 里补 —— 该目录会被自动加载，
      加新模组补译只要放入一个 `*-extra.lang`，不用改命令行。
    - **任务名**（`BQQUEST_RAW`）按 BQ 的 22 位 base64 ID 查。脚本里 `QUEST_KEY` 的字符集
      原来只有 `[A-Za-z0-9+/=]`，把 base64url 风格（带 `-` `_`）的 ID 整条漏掉 ——
      12 阶的「你准备好了吗？」(`v5GltE2BTW-Me_rEqy5uFg`) 即因此遗漏，
      表现是任务分享只显示「分享了一个任务」。字符集必须带 `-_`。
    - **原版成就名**（`achievement.*`）**汉化包里没有**：汉化包只覆盖模组，原版走客户端自带语言。
      所以要把 `tools/data/minecraft-1.7.10-zh_CN.lang`（1.7.10 官方资源，assets 对象
      `eb206c38…`，用第 6 个参数传）一起喂进去，否则「Taking Inventory」永远是英文。
    - 汉化包更新后**必须重新执行**，否则新任务/新成就名一直缺失。参数见仓库根 `AGENTS.md` §3.2。
27. **`zh()` 是整串精确匹配**，不做分词：`Conveyor Module (UXV)` 能翻是因为字典里有这一整条
    （GT 的 `GregTech.lang` 提供了带电压后缀的名字）。所以 GT 成就显示成「传送带（UXV）」是
    汉化包的译法，不是 App 拼错。
28. **成就/任务的中文只影响「显示」，不影响功能**：查不到就原样显示英文或通用文案，不会崩溃 —— 排查「没汉化」先看字典条目是否存在，不要先怀疑渲染。

## 3.0.0 网络层：HTTP/SSE → 裸 TCP（2026-10-27）

**协议契约在 `../../AEMobile/doc/传输协议与安全.md`，改接口前必须先读。**

```
屏幕  ──openStream(cfg,'items',params) / request(cfg,'plan',params,onProgress)──▶  api.ts
api.ts ──▶ net/conn.ts（单例：握手/鉴权/请求多路复用/订阅/保活/重连）──▶ net/protocol.ts（帧编解码）
```

- **`react-native-tcp-socket` 是原生模块**：加它之后必须重新构建 APK（debug 与 release 都要）。
  只改 JS 不重建会直接报 native module 找不到。`buffer` 也一起显式装上了（帧编解码用它）。
- **屏幕层拿到的 `Stream` 是 EventSource 的形状**（`addEventListener('message'|'error')` + `close()`），
  `ev.data` 就是帧对象，所以屏幕里的 `parseFrame(ev.data)` 不用改。
- **不要自己写重试**。连接层已经做了指数退避重连 + 重连后自动续订（带 sid），
  2.1.0 的 `attachRetry` 已删除，再加一层会变成双重重连。

### 已知问题（接着上面编号）
21. **`request` 与路由参数重名**：`route.params.request` 会遮住 api 的 `request`，那里 import 成了 `request as apiRequest`。
22. **`plan` 是「一条请求多条响应」**：`request(cfg,'plan',params,onProgress)` 的第四个参数收进度，
    最终结果在 Promise 里。不要用 `openStream` 去做 plan（服务端没有 plan 这个 stream）。
23. **TCP 的 `timeout` 选项是「空闲超时」**，不能拿来当建连超时（本客户端每 20s 发送一个 PING，设 10s 会一直触发）。
    建连超时由 `conn.ts` 内的 `setTimeout` 控制。
24. **`AUTH_FAILED` 不重连**：错误会带 `xhrStatus: 401` 抛给屏幕（物品页据此提示「密码错误」）。
    `CLOCK` 会自动用服务端时间重签一次，不应在屏幕上显示它。
25. **mock 也是 TCP 了**：`node mock/server.mjs 44444`，token 固定 `MOCKTOKEN234567ABCDEFGHJKLM`。
    端到端回归：先把 `src/auth.ts` / `src/net/protocol.ts` 编译到 `mock/gen`，再 `node mock/e2e.cjs 44444`
    （见 `../../AEMobile/doc/传输协议与安全.md` §11）。
26. **`scheme` 字段还在但恒为 `tcp`**：`ServerConfig.scheme` 只为兼容旧账号记录，UI 里已经没有 HTTP/HTTPS 选项，
    `baseUrl()` 只输出 `ip:port`。
27. **升版本号后「关于」还显示旧版本**：`expo-constants` 的 `createExpoConfig` 任务没声明输入，
    改 `app.config.js` 不会让它重新执行。现在 `appinfo.ts` 用 `Constants.nativeAppVersion`
    （来自 `android/app/build.gradle` 的 versionName）作为后备，改那里即可；要让 `expoConfig.version`
    也刷新，还需删除 `node_modules/expo-constants/android/build/generated/assets/expo-constants` 再打包。
28. **`ResolvedItem` 的 `icon` / `dname` / `aspectTint` 是惰性 getter，不要展开它**。
    `{...item}`、`Object.assign({}, item)` 都会立刻触发查库，等于把「按需加载」变回「全量加载」。
    列表页要额外字段就往 `Row` 上加，不要拷贝 `res` 本身。
29. **不要用 `Object.defineProperty` 做惰性字段**。实测它会把 Hermes 对象切成字典模式，
    之后所有属性访问都变慢，6609 条要 201ms。正确写法是 class + 原型上的 getter（现在的 `ResolvedItem`）。
30. **批量查名字不要用「返回多行」**。`getAllSync` 读取 45 × 150 行（每行 3 列）在模拟器上要 750ms，
    而 SQLite 本身只要 38ms —— 时间全花在 JSI 逐行转 JS 对象上。现在用
    `select group_concat(k, char(2)) from (...)` 把整块合并为一个字符串再在 JS 里 split。
31. **`item_panel` 需要覆盖索引 `idx_item_dname(item_name, item_meta, dname)`**。
    dname 和 3KB 的图标 BLOB 在同一行，只取名字也要读整行（194MB 库 = 随机读盘，取 6000 个名字 428ms）。
    有了覆盖索引走 `COVERING INDEX`，降到 85ms。建库脚本已带上；旧库由 App 在启动 5 秒后后台补建
    （`ensureNameIndex`，194MB 库上约 0.7–2 秒，按库文件名记标记，换库会重建）。
32. **不要启用 `PRAGMA mmap_size`**。试过 64MB：RSS 直接多出 70MB（`Other mmap` 全是 clean 页），
    换来的搜索提速只有 20ms，低端机上更容易被 LMK 终止。`cache_size = -8000` 即可满足。
33. **`materializeBundledPacks()` 曾每次启动都解压一遍内置库**（194MB / 895ms，占启动的 90%）。
    现在两道短路：用的是在线包就跳过、SecureStore 记录已落地的 sha。注意 `resolveActiveDb` 在
    「回落到内置但文件不存在」时会带 `true` 补一次。
34. **`writeCache` 的节流是 trailing**（窗口内只写最后一次），以前是直接丢弃 ——
    高频流断线瞬间的最后一次状态永远落不了盘。另外序列化（几 MB 的 `JSON.stringify`）放进了
    `setTimeout`，不要再移回同步路径，会掉帧。
35. **`embed_pack.py` 是「iconpack/ → assets/」的复制方向**，而 `update_packs.py` 直接写 `assets/` ——
    顺序反了会用 `iconpack/` 里的旧库覆盖刚建好的新库（2026-10-29 实际发生过）。
    现在 `update_packs.py` 末尾会自动 `sync_iconpack_dir()`，但不要只手工执行一半。
36. **内置包落地不能只比文件大小**。`fluids.db` 每次重建大小都是 2007040 字节，
    按大小判断会跳过复制、却把标记写成新的 sha，设备上就永远留着旧库。
    现在只要 sha 标记不匹配就无条件复制；标记键带 `v2` 前缀，旧标记已失效。
- 鉴权是 **HMAC 签名头**（`src/auth.ts`），token 不在网络上传输；服务端只接受 ±600s 的时间戳，
  所以 **`/AEMobileTest` 对时是必需的**，不是可选优化。流解析必须走 `src/frames.ts` 的 Accumulator
  （全量 + 增量 + 心跳），**不能直接 `JSON.parse`**；只有 `generateCraftingPlan` 还是 `{succeed, body, message}`。
37. **`@noble/hashes` 是纯 JS 依赖**，不要换成需要原生模块的库（会破坏「装 APK 即用」）。版本锁 1.4.0。
38. **签名用的 query 必须和实际发出去的字节完全一致**。`api.ts` 里 `buildQuery()` 只在一处生成，
    传给 `authHeader()` 和 `fetch()` 的是同一个字符串。**不要在两个地方各拼一次**，否则签名必然对不上。
39. **401 有两种含义**：`CLOCK`（时钟偏差，会自动对时重试一次）和 `AUTH_FAILED`（密码错）。
    排查「一直连不上」时先看服务端日志里的错误码，不要一律当作密码错。
40. **增量帧的 diff 快照必须存值拷贝**：服务端 `StreamState` 存的是 `long[]{count, craftable}`，
    mock 存过对象引用，下一轮 mutate 把快照也改了，增量永远判定「无变化」只发心跳。
41. **`frames.ts` 的累加器会跳过 `name` 不是字符串的行**。这是针对服务端 bug 的后备保护——
    mock 曾发出 `name=null` 的增量行，App 直接崩溃于 `resolveItem` 的 `name.includes`。
    改服务端时如果发现某类条目"消失了"，先检查是否被这层防御过滤。
42. **底部弹层：遮罩必须和面板平级**。`<TouchableOpacity style={mask}><View style={sheet}>` 的写法会把
    列表滑动识别成「点遮罩」直接关闭弹层。正确写法是 `<View style={mask}><TouchableOpacity
    style={StyleSheet.absoluteFill} onPress={close}/><View style={sheet}>`（列表短时看不出来）。
43. **弹层里的长列表一定要 `ScrollView` + `maxHeight`**，否则面板会超出屏幕，标题和顶部按钮都无法点击。
44. **`formatItemCount` 到 `E` 为止**。AE2 的 CPU 容量接近 `Long.MAX`，少一级就会输出科学计数法（`8.39e+6T`）。
45. **换 App 图标只改 `assets/` 是无效的**：`android/` 是已 prebuild 好的原生工程，Expo 的
   `icon` / `adaptiveIcon` 只在 prebuild 时才写进 `res/mipmap-*`。要换就直接替换那 20 个文件
   （5 档密度 × 4 个）：`ic_launcher.png`（底色铺满）、`ic_launcher_round.png`（按圆遮罩裁）、
   - `.../ic_launcher_foreground.png`（自适应前景，透明底，内容缩到 **57.5%**：108dp 画布里 62dp，
     恰好落入系统只显示的 66dp 安全圆）
   - `.../ic_launcher_monochrome.png`（Android 13 主题图标，纯黑剪影 + 透明底，**不能有底色**）
   尺寸分别是 108 / 162 / 216 / 324 / 432 px。`mipmap-anydpi-v26/ic_launcher.xml` 引用的是
   `@color/iconBackground`（当前 `#0F162E`，`values/` 和 `values-night/` 都改了，避免图标随主题变化）
   + `@mipmap/ic_launcher_foreground`。
   `assets/icon.png` / `assets/adaptive-icon.png` / `app.config.js` 的 `adaptiveIcon.backgroundColor`
   也一起更新，保证以后执行 prebuild 时保持一致。
46. **底栏图标"先有字后出图标"是字体没预加载**。`@expo/vector-icons` 是**第一次渲染图标时**
    才去加载 ttf 的。修法：`App.tsx` 里 `useFonts(Ionicons.font)`，并在字体没就绪前继续显示
    `BootOverlay`。现在撤除 `BootOverlay` 的条件还多了两条：主界面 ready，且**入场动画放完**
    （`BOOT_MIN_MS` = 900ms，正常启动 320ms 就 ready，不等待动画完成会被截断一半）。
47. **echarts 绝不能进启动路径**：两道懒加载 `React.lazy(MonitorScreen)` + `React.lazy(MonitorChart)`，
    图表**只有实际收到 tick 数据**（`points.length > 0`）才挂载（见第 5 条）。
48. **`@shopify/react-native-skia` 并非未使用的依赖**：`components/SkinHead.tsx` 用
    `Canvas + ImageShader`（`fm:"nearest"`）裁游戏皮肤头部，像素风不模糊；`librnskia.so`
    会被加载。不要再按“没用”把它从依赖里删掉（2026-10-30 改）。
    另外 ECharts 仍走 SVGRenderer（见第 5 条），两套图形栈并存。
49. **`FileSystem.getInfoAsync()` 只认 `file://` URI**（2026-10-29）。`attachAux()` 里用裸路径
    （`ATTACH` 要裸路径）去调用它，永远返回 `exists:false` → `fluids.db` / `essentia.db`
    **一次都没挂上**，流体退回纯色块、源质退回占位图。判断「换了图标库没反应」先看
    `adb logcat | grep AEMobile` 有没有 `attach-fail` / `fluid-icon-fail`，不要先怀疑库内容。
50. **附属模组的源质要素要按 `Aspect.getImage()` 找图**。`terminus` / `custom1-5` / `caelum` /
    `tabernus` / `evolutio` 的 tag 和贴图文件名对不上（GT 用大写 `AEQUALITAS.png` 注册成
    `custom1`；`terminus` 在 `avaritia/textures/misc/`、`evolutio` 在
    `gtnhcommunitymod/textures/icons/`），只按文件名匹配会落到 `_unknown`（游戏里显示问号）。
    `dump aspects` 导出的 `aspect-images.tsv` + `build_aspects.py --images` 为正确方案。
51. **`fluid_icon` 的名字要取并集**：`fluid_container` ∪ `fluid_name` ∪ 图集坐标。只按
    `fluid_container` 建表会漏掉「GT 有名字但没单元」的流体（如超临界致密蒸汽），App 只能画色块。
52. **`AEMobile` 仓库的 `gradlew` 不能保留前端构建步骤**（2026-10-29）。上游的 wrapper 会
    `cd AEMonitor-Frontend && npm build && cp -r build/* ../src/main/resources/static`；
    子模块删掉后 `cd` 失败、cwd 留在仓库根，`../src/...` 指到**仓库外**，把整个 gradle build
    目录拷过去，额外多出 653MB。现在 `gradlew` 只做 `exec ./gradlew.in "$@"`，不要加回去。
    另外构建必须带 `JAVA_HOME=<zulu8>`，默认 JDK 18 会报 `This project requires Java 8`。
53. **流体行的 `name` 是容器物品，下单必须用 `original_name`**（2026-10-29）。`resolveItem()`
    为了显示，把 `ae2fc:fluid_drop` 换成了容器物品（单元/桶）的 name/meta。打开详情页时如果传
    `res.name`，详情页将无法识别这是流体（`isFluid=false`），`plan` 发过去的是「硫酸单元」——
    服务端算不出计划。传 `res.original_name ?? res.name`，详情页里 `resolveItem` 会重新解析成流体。
54. **源质/流体在增量帧里必须带 NBT**。`itemKey()` 对 `ae2fc:fluid_drop` 和
    `thaumicenergistics:essentia` 用 `name|meta|nbt` 做键，服务端 `c` 行缺少 NBT 就会新建一条
    `xxx:0` 的错误行，旧行永远不更新（表现：要素数量一直不变）。服务端侧对应
    `StreamState.needsNbt()`，两边要一起改。
55. **数量单位不是「个」的三种行**：流体是 mB（1 B = 1000 mB，输入框默认 1000、快捷键 1B/16B/72B/144B），
    源质/要素是「个」。详情页的 5 万上限只对普通物品生效，不要将其应用于流体（流体的 76.5T mB 很常见）。
56. **`plan` 里流体/要素的数量是「一次合成」的量**，和请求数量无关（AE2 的口径，服务端不做换算）。
    请求 1 mB 和 1000 mB 得到的是同一组数字，界面上不要将其与请求量对比。
57. **监控页的数据是两路，不要合并**（2026-10-30）。`REQ tps` 给全量世界清单（~4.5KB，进页面/60 秒一次），
    `SUB tps` 只给被检测维度的 tick 数字（~200B/5 秒）。本服有 91 个维度，每帧带全量清单是
    6KB/帧 = **4MB/小时**，手机上纯属无意义的流量消耗。
58. **`apply`（收到帧的回调）不能把 `meta`/`worldSeries` 放进 useCallback 依赖**。放进去会让回调
    每 60 秒重建一次，而它又是 `useFocusEffect` 的依赖 → 整条订阅被关闭后重新开启，曲线出现断档。
    正确做法：需要读的最新值放 `useRef`，回调依赖只留 `cacheKey`。
59. **`Segmented` 要控宽度就把 `style` 直接传给它，不要在外层套 `View`**（2026-10-30 真机实测发现）。
    套一层 `<View style={{flex:1}}>` 时两个并排会使第二个超出屏幕（`Segmented` 内部的 item 是
    `flex:1`、外层 `wrap` 没宽度）；套 `width` 时虽然画面对，但出现过点击无响应的情况（触摸区域异常）。
    现在 `Segmented` 有可选 `style`，直接 `<Segmented style={{width: segW}} …/>`，
    横向父容器不要再写 `alignItems:'center'`。
    **另外**：刚切到监控页的头几秒（echarts 懒加载 + 91 个世界首次渲染）点击事件可能被忽略，
    滚动或等待两秒后再点击即恢复正常 —— 真机已复现，不要误判为事件绑定错误。
60. **列表一次不要渲染 91 行**。`ScrollView` 不做虚拟化，91 行 × 4 个 View 会明显掉帧；
    监控页默认只画前 25 行 + 「展开」。
61. **模拟器验证要先有图标库**：`App.tsx` 用 `resolveActiveDb()` 判断，没有库就一直停在
    「首次使用」页（配置包只写账号，不解锁主界面）。本地启动一个静态服务指向 `iconpack/` 即可：
    `cd iconpack && python -m http.server 8000 --bind 127.0.0.1`，App 里填
    `http://10.0.2.2:8000/version.json`（清单 `version.json` 要自己按三个库的 sha256/size 生成）。
    装完第一次进主界面可能报 `NativeDatabase.initAsync ... Access to closed resource`，**点「重试」即可**。
62. **音乐面板的键盘**（2026-10-30）：`MusicScreen` 的 `ScrollView` 必须
    `keyboardShouldPersistTaps="handled"`，搜索后 `Keyboard.dismiss()`；否则键盘打开时首次点「点歌」
    只会收起键盘，表现为按钮无响应。
63. **音乐桥错误码**：`BRIDGE_UNAVAILABLE`（host/port 不通）、`BRIDGE_DISABLED`、`BAD_SECRET`、
    `COMMAND_NOT_ALLOWED:music`（BC 的 `allow-commands` 没开）、`UNKNOWN_COMMAND`（AllMusic 没装）、
    `NO_MUSIC_SESSION`（没有音乐会话）。搜歌异步要等 3.5s，不要在 500ms 即判定失败。
64. **音乐结果只回发起者**：AllMusic 的搜索/帮助/队列走桥接捕获型 sender，不进公共聊天；
    公共聊天只收带 `[AllMusic3]`/`[肥猫电台]` 且含 `[music] publicMarkers`（默认「正在播放」）的消息。
    改聊天抓取时不要把私有结果广播出去。
65. **离线点歌的边界**：桥接虚拟 sender 能搜歌/队列/投票，但实际点歌需要服务器有音乐会话
    （AllMusic 客户端在线）；没有时 AllMusic 回「没有播放的玩家」，App 显示友好提示。
66. **聊天未读/合并**：未读只算 kind 0/4/5/6 和其他玩家的 kind 1；进出（2/3）不重复计入。
67. **内联面板只写 `maxHeight` 会被压缩**（2026-10-31）：面板和消息列表（`flex:1`）平级时，
    只给 `maxHeight` 的话面板会被压缩到只剩一行（实测）。要么给确定 `height`，
    要么 `maxHeight` + `flexShrink: 0`（现在用的后者），滚动交给内部 `ScrollView`。
68. **输入栏旁边的面板不要用 `Modal`**：Modal 会抢占焦点，输入框一失焦键盘就收起，打完 `/` 面板弹出的同时
    键盘消失。聊天页的三个面板都直接插在消息列表和输入栏之间。**消息里的操作面板例外**（任务附件那个
    `QuestSheet`）：入口在消息列表里、本来就没有可抢占的焦点，用 Modal 反而避免把状态提升到 ChatScreen。
69. **`§0`/`§8` 在深色气泡上不可见**：颜色码不能直接沿用游戏原色，按感知亮度往白里混
    （`mcformat.readable`，用混白不用乘系数 —— 纯黑乘任何数还是纯黑）。
70. **`@我` 高亮按词边界匹配**：`@老王2` 不能算 `@老王`，否则会误亮；正则尾部要排除
    字母数字下划线和中文。
71. **在线任务书只认 `?id=`，而且 ID 必须带 `==` 填充**（2026-11-02）：站点 `bundle.js` 的
    `checkHasQuestIdInParameters()` 将 `url.searchParams.get('id')` 直接作为 `questIdToQuest` 的键，
    而键就是 `quest_json.json` 里 `quest_id` 的原文（16 字节 UUID → base64url，24 字符带 `==`），
    少一个字符都进不去弹层。服务端 `ChatRich.QUEST_ID` 的正则不认 `=`，发到手机上只有 22 位，
    所以 App 侧 `questbook.normQuestId()` 统一补齐；修改时不要一并移除填充。
72. **`Clipboard` 还在 react-native 核心里**（0.74）：导入会打一条 deprecation 警告，但旧架构下能直接用，
    换成 `expo-clipboard` 要加原生依赖 + 重新执行 prebuild —— 为一次复制不值得。
73. **`loadActiveConfig` 是显式解构，加字段不要遗漏**（2026-11-03）：`accounts.ts` 里它仅复制
    `scheme/ip/port/token/mainnet`，新加的 `guest` 未包含 → `isConfigComplete` 读取不到 → 游客
    点了「仅使用聊天」却无法进入主界面。凡是 `ServerConfig` 新增字段，先检查这个函数。
74. **目录名带中文的 App 副本无法直接构建**（2026-11-03）：`AEMobileApp-深空矩阵` 触发三层问题 ——
    AGP 拒绝非 ASCII 路径（`android.overridePathCheck` 也无效）；`subst` 映射盘后 Metro 的
    realpath 解析回真实中文路径，「Unable to resolve module ../barrier.png」；node 输出的
    node_modules 路径进 Gradle 后编码错乱（settings.gradle 找不到 autolinking.gradle）。
    结论：**构建时把源码复制进 ASCII 临时目录**（`tmp/dsm-build`），node_modules 联接到
    主仓库（同为 ASCII + 同盘符），`build_deepspace.py` 已把这些步骤自动化。
75. **node_modules 不能跨盘符联接**：Expo CLI 检查「this and base files have different roots」；
    联接目标必须和项目同盘符，且路径本身最好也是 ASCII（见 73）。
    隐藏进出提示要在 `chatgroup.buildRows` 分组阶段跳过，否则会打断同一人的 5 分钟合并、留下空日期头。
73. **物品名带 `§` 颜色码是常态，三处都要剥**（2026-11-02）：NEI 分享用的是
    `ItemStack.getChatComponent()`，里面是**带码的显示名**，而 `getUnformattedText()`
    只摊平组件树、**不剥码**。所以：
    - 服务端 `ChatRich.stripCodes()` 在写 `att` 前剥（新消息干净）；
    - App 的 `zhdict.lookup()` 查不到时剥码再查一次（兼容已落盘的历史消息，也兼容未更换 jar 的服务端）；
    - 图标库的 `dname` 由 `tools/build_item_icons.py` 的 `_strip_codes()` 在重建时剥
      （旧行同样处理，所以重新执行一次就能清理历史残留）。
    不剥的话界面上会原样打出 `§l§d奥术裂隙`，而且字典键是剥过码的纯文本 —— 两处同时失效。

## 验证方式

- `npx tsc --noEmit` 必须干净；纯逻辑单测 `node --test test/chatgroup.test.ts test/avatarurl.test.ts test/skincrop.test.ts test/questbook.test.ts`。
- `cd android && ./gradlew assembleRelease`，装模拟器。
- 主流程：物品/合成都走真实服务器；聊天双向、进出系统行、服务器广播、AllMusic「正在播放」、
  音乐面板搜歌（点歌在无音乐会话时显示友好提示）。
- 不能启动游戏客户端时，明确说明哪些是静态分析/模拟器 UI 验证。

## 临时文件

- 验证截图、裁剪图、一次性脚本的中间产物、调试导出**一律放工作区根目录的 `tmp/`**
  （`D:/Develop/Game/AEMobildAll/tmp/`，规则见那里的 `README.md`）。
- **不要往仓库根目录或 `doc/` 里放入 png**：2026-10-31 清理过一次工作区根目录，
  40+ 张调试截图 + 一份旧 `console.log` + 4 个重复 ps1 + 一个废弃仓库目录，占用 21MB。
- `tmp/` 里的内容随时可以整目录删除，不要放入还需要的内容；能复用的脚本放 `tools/`，
  长期素材放 `refs/`。
- App 截图用 `python tools/adb_ui.py shot <名字>`，它默认存 `.workbuddy-ai/shots/`，
  不会污染根目录。

## 代码风格

- 跟随现有文件的风格和陈旧程度，不要单方面重排；中文注释密度低。
- 状态用 Provider + SecureStore（gridprefs/chatprefs 的模式），不要引入新的状态库。

## 交接

- 先读工作区根 `AGENTS.md`（当前状态、路径、已知问题、待办）和 `../AEMobile/doc/传输协议与安全.md`（改网络前必读）。