"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadLastConn = loadLastConn;
exports.saveLastConn = saveLastConn;
/**
 * 连接信息持久化（@react-native-async-storage/async-storage）：
 * 上次成功的后端地址与账号名，登录屏预填。存取失败静默降级（不阻塞登录流程）。
 */
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const KEY = 'horizon.conn.last';
async function loadLastConn() {
    try {
        const raw = await async_storage_1.default.getItem(KEY);
        if (!raw)
            return null;
        const v = JSON.parse(raw);
        if (typeof v.host === 'string' && typeof v.port === 'number' && typeof v.name === 'string') {
            return v;
        }
        return null;
    }
    catch {
        return null;
    }
}
async function saveLastConn(v) {
    try {
        await async_storage_1.default.setItem(KEY, JSON.stringify(v));
    }
    catch {
        // 持久化失败不阻塞主流程
    }
}
