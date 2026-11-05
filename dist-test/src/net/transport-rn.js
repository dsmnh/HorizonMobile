"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RnTransport = void 0;
/**
 * react-native-tcp-socket 传输适配器（RN 运行时用；测试环境用 test/transport-node.ts）。
 * 实现 conn.ts 的 Transport 接口。依赖：react-native-tcp-socket（expo 51 项目按需安装）。
 *
 * 注意：RN 环境无 Buffer polyfill 时需引入 buffer 包（AEMobileApp 底座已含 buffer 依赖）。
 */
const react_native_tcp_socket_1 = __importDefault(require("react-native-tcp-socket"));
const buffer_1 = require("buffer");
class RnTransport {
    constructor() {
        this.socket = null;
        this.dataCb = null;
        this.closeCb = null;
    }
    connect(host, port) {
        return new Promise((resolve, reject) => {
            this.socket = react_native_tcp_socket_1.default.createConnection({ host, port }, () => resolve());
            this.socket.on('data', (chunk) => {
                if (this.dataCb)
                    this.dataCb(buffer_1.Buffer.from(chunk));
            });
            this.socket.on('close', () => {
                if (this.closeCb)
                    this.closeCb();
            });
            this.socket.on('error', () => {
                if (this.closeCb)
                    this.closeCb();
            });
        });
    }
    write(data) {
        if (this.socket)
            this.socket.write(data);
    }
    onData(cb) {
        this.dataCb = cb;
    }
    onClose(cb) {
        this.closeCb = cb;
    }
    close() {
        if (this.socket)
            this.socket.destroy();
        this.socket = null;
    }
}
exports.RnTransport = RnTransport;
