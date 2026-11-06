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
        this.generation += 1;
        const gen = this.generation;
        const socket = node_net_1.default.connect({ host, port });
        this.socket = socket;
        return new Promise((resolve, reject) => {
            socket.once('connect', () => resolve());
            socket.once('error', (e) => { if (gen === this.generation)
                reject(e); });
            socket.on('data', (chunk) => {
                if (gen !== this.generation || this.socket !== socket)
                    return;
                if (this.dataCb)
                    this.dataCb(chunk);
            });
            socket.on('close', () => {
                if (gen !== this.generation || this.socket !== socket)
                    return;
                if (this.closeCb)
                    this.closeCb();
            });
            socket.on('error', () => {
                if (gen !== this.generation || this.socket !== socket)
                    return;
            });
        });
    }
    write(data) {
        if (this.socket) {
            this.socket.write(data);
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
