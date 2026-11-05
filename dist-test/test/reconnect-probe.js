"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_cjs_1 = require("../mock/server.cjs");
const conn_1 = require("../src/net/conn");
const transport_node_1 = require("./transport-node");
async function main() {
    const backend = new server_cjs_1.MockAppBackend();
    const port = await backend.listen();
    backend.handlers.set('account.uuids', () => ({ uuids: [] }));
    backend.dropAfterAuth = true;
    const conn = new conn_1.HorizonConn(new transport_node_1.NodeTransport(), {
        host: '127.0.0.1', port, token: backend.token,
        backoffInitialMs: 100, requestTimeoutMs: 5000,
    });
    const timer = setTimeout(() => {
        backend.dropAfterAuth = false;
    }, 1200);
    await conn.start();
    clearTimeout(timer);
    console.log('[probe] reconnected, authed=', conn.isConnected);
    const uuids = await conn.req('account.uuids');
    console.log('[probe] req ok=', uuids.ok);
    conn.close();
    backend.close();
    console.log('== 探针完成 ==');
}
void main();
