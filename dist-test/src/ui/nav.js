"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppContext = void 0;
exports.useApp = useApp;
/**
 * 导航骨架（迁移适配指南 §屏幕接线深化）：AppContext + NativeStack 六路由。
 * 屏幕组件保持 props 无感（路由包装层从 context 取值下传），后续按需拆分更多路由。
 */
const react_1 = require("react");
exports.AppContext = (0, react_1.createContext)({
    conn: null,
    connected: false,
    uuids: [],
    setUuids: () => undefined,
    authenticate: async () => undefined,
    disconnect: () => undefined,
    busy: false,
    error: '',
});
function useApp() {
    return (0, react_1.useContext)(exports.AppContext);
}
