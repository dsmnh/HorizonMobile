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
        this.generation = 0;
        this.dataCb = null;
        this.closeCb = null;
    }
    connect(host, port) {
        const gen = this.generation;
        return new Promise((resolve, reject) => {
            const socket = node_net_1.default.connect({ host, port }, () => resolve());
            this.socket = socket;
            socket.on('data', (chunk) => {
                if (gen !== this.generation)
                    return;
                if (this.dataCb)
                    this.dataCb(chunk);
            });
            socket.on('close', () => {
                if (gen !== this.generation)
                    return;
                if (this.closeCb)
                    this.closeCb();
            });
            socket.on('error', () => {
                if (gen !== this.generation)
                    return;
                if (this.closeCb)
                    this.closeCb();
            });
        });
    }
    write(data) {
        if (this.socket) {
            console.error('[xport] w' + (data[4] ?? -1).toString(16));
            this.socket.write(data);
        }
        else {
            console.error('[xport] w-closed');
        }
    }
    onData(cb) {
        this.dataCb = cb;
    }
    onClose(cb) {
        this.closeCb = cb;
    }
    close() {
        this.generation += 1;
        if (this.socket)
            this.socket.destroy();
        this.socket = null;
    }
}
exports.NodeTransport = NodeTransport;
