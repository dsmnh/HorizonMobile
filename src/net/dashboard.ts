interface DashboardNode {
  offline?: boolean;
  frame?: { players?: number; tps?: number };
}

export function summarizeNodes(nodes: DashboardNode[]) {
  const frames = nodes.flatMap(({ offline, frame }) => !offline && frame ? [frame] : []);
  const players = frames.flatMap(({ players }) => typeof players === 'number' && Number.isFinite(players) ? [players] : []);
  const tps = frames.flatMap(({ tps }) => typeof tps === 'number' && Number.isFinite(tps) ? [tps] : []);
  return {
    online: frames.length,
    total: nodes.length,
    players: players.length ? players.reduce((total, count) => total + count, 0) : null,
    minTps: tps.length ? Math.min(...tps) : null,
  };
}
