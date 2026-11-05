"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeTransport = void 0;
/** node:net 传输适配器：e2e/mock 环境用；RN 运行时替换为 react-native-tcp-socket 适配器。 */
const node_net_1 = __importDefault(require("node:net"));
class NodeTransport {
    constructor() {
        this.socket = null;
        this.dataCb = null;
        this.closeCb = null;
    }
    connect(host, port) {
        return new Promise((resolve, reject) => {
            this.socket = node_net_1.default.connect({ host, port }, () => resolve());
            this.socket.on('data', (chunk) => {
                if (this.dataCb)
                    this.dataCb(chunk);
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
        if (this.socket) {
            console.error('[xport] write type=0x' + (data[4] ?? -1).toString(16) + ' len=' + data.length);
            this.socket.write(data);
        }
        else {
            console.error('[xport] write on closed socket');
        }
    }
    onData(cb) {
        this.dataCb = cb;
    }
    onClose(cb) {
        this.closeCb = () => {
            console.error('[xport] closed');
            cb();
        };
    }
    close() {
        if (this.socket)
            this.socket.destroy();
        this.socket = null;
    }
}
exports.NodeTransport = NodeTransport;
