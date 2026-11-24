const fs = require('node:fs');
const path = require('node:path');

const packagePath = require.resolve('react-native-screens/package.json');
const sourcePath = path.join(path.dirname(packagePath),
  'android/src/main/java/com/swmansion/rnscreens/ScreenStack.kt');
const source = fs.readFileSync(sourcePath, 'utf8');
// With compileSdk 35, Kotlin resolves removeLast to the Android 15 List API.
const before = 'else drawingOpPool.removeLast()';
const after = 'else drawingOpPool.removeAt(drawingOpPool.lastIndex)';
if (source.includes(before)) {
  fs.writeFileSync(sourcePath, source.replace(before, after));
} else if (!source.includes(after)) {
  throw new Error('Recheck the Android API compatibility patch for react-native-screens');
}
