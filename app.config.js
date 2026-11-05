module.exports = {
  "expo": {
    "name": "HorizonMobile",
    "slug": "HorizonMobile",
    "version": "3.6.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "resizeMode": "contain",
      "backgroundColor": "#0B0E14"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.dsmnh.mobile.app",
      "buildNumber": "7"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0F162E",
      },
      "package": "com.dsmnh.mobile.app",
      "versionCode": 43
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "592a287e-bcc2-4ace-b3fc-efe1f73ec693"
      }
    },
    "plugins": [[
      "expo-build-properties",
      {
        "android": {
          "usesCleartextTraffic": true
        }
      }
    ]]
  }
}