#!/usr/bin/env node
/*
 * 原生依赖补丁：expo prebuild 生成的 android/ 与 node_modules 里有两处与本机工具链不兼容，
 * 每次重新 prebuild 或重装依赖后需重新执行，保证 assembleRelease 可复现。
 * 用法：node scripts/patch-native-modules.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targets = [
  {
    // compileSdk 35 的 android.jar 含 Java 21 SequencedCollection，编译期会选中 List.removeLast()；
    // 运行在 API 32 及以下设备时该方法不存在，退回按索引删除。
    file: 'node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStack.kt',
    from: 'drawingOpPool.removeLast()',
    to: 'drawingOpPool.removeAt(drawingOpPool.size - 1)',
  },
  {
    // getPackageInfo(...).requestedPermissions 可空，Kotlin 严格空安全拒绝直接调用。
    file: 'node_modules/expo-modules-core/android/src/main/java/expo/modules/adapters/react/permissions/PermissionsService.kt',
    from: 'return requestedPermissions.contains(permission)',
    to: 'return requestedPermissions?.contains(permission) == true',
  },
];

let changed = 0;
for (const t of targets) {
  const p = join(root, t.file);
  if (!existsSync(p)) {
    console.log('skip (missing): ' + t.file);
    continue;
  }
  const src = readFileSync(p, 'utf8');
  if (src.includes(t.to)) {
    console.log('already patched: ' + t.file);
    continue;
  }
  if (!src.includes(t.from)) {
    console.log('pattern not found: ' + t.file);
    continue;
  }
  writeFileSync(p, src.replace(t.from, t.to));
  changed += 1;
  console.log('patched: ' + t.file);
}
console.log('done, changed=' + changed);
