# HorizonMobile

Horizon 生态的 Android App（深空矩阵新视野）。底座迁移自 AEMobileApp（原仓库保留于个人账号）。

## 当前状态（骨架）

- `src/net/`：**现役协议栈**（契约 1.2.0+，App 平面：帧编解码、HORIZON HMAC、多路复用连接、team 流）。
- `src-app-legacy/`：AEMobileApp 底座源码（协议 3.0.0 形态）——UI 层（screens/components）逐板块适配现役协议后迁入 `src/`，见 测试待办.md。
- `mock-aemobile/`：旧 mock（对拍参考）；现役 mock 对拍骨架在 `mock/`。
- `assets-aemobile/`：显示资产（图标库等，待裁剪）。

## 迁移待办（阶段 8）

1. RN 传输适配器：react-native-tcp-socket 实现 Transport 接口（现协议栈已抽象）。
2. 逐屏适配：旧 screens 的请求/订阅调用点改接现役 conn/Stream。
3. 账号域 UI：注册/登录/绑定码/会话管理（契约 1.0.0 账号域）。
4. 构建链：expo/android 首次构建与包名 `com.dsmnh.mobile.app` 落地。

## 构建

待迁移完成后补（expo 51 / RN 0.74.3）。
