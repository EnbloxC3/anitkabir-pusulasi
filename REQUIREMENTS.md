# Requirements

## Base Requirements (for apps stable work)

- Secure Origin
- JavaScript ES6

## User Requirements

### Device

| App Function           | Requirement                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| Geolocation            | Hardware capable of providing positional info; GPS/GNSS, Wi-Fi/Cellular, Bluetooth/BLE etc. |
| Camera (Optional)      | Hardware capable of capturing video; Camera sensors or modules                              |
| Orientation (Optional) | Hardware capable of providing 3D orientation; Accelerometer, Gyroscope, (Magnetometer)      |

### Browser

| Browser / engine       | Minimum version |
| ---------------------- | --------------- |
| Google Chrome          | 111             |
| Microsoft Edge         | 111             |
| Mozilla Firefox        | 114             |
| Safari (macOS)         | 16.4            |
| Safari (iOS / iPadOS)  | 16.4            |
| Chromium-based WebView | Chromium 111    |

> **According to:** Permission API: Geolocation Geolocation, MediaDevices Camera, DeviceOrientationEvent Orientation-Absolute
> CSS: functions and rules

### Android App

| Kind                   | Minimum version             |
| ---------------------- | --------------------------- |
| Android Version        | 7 (24)                      |
| Android System WebView | 111.0.5563.116 (March 2023) |

> **According to:** Version: Build Min SDK
> WebView: Browser minimum requirements

### iOS App

`This project has no iOS platform`

## Dev Requirements

### Initial

| Kind     | Minimums/Requirements           |
| -------- | ------------------------------- |
| OS       | any (at least POSIX compatible) |
| Node.js  | >=22.12                         |
| Npm      | >~11.7.0                        |
| Optional | Text Editor (VSCod(e/ium))      |

### Web

| Kind       | Minimums/Requirements |
| ---------- | --------------------- |
| Vite       | 7                     |
| Capacitor  | 8                     |
| Framework7 | 9                     |

### Android App

| Kind     | Minimums/Requirements                                   |
| -------- | ------------------------------------------------------- |
| JDK      | 17 (changeable)                                         |
| Gradle   | Gradle 8.14.3 (wrapper)                                 |
| Optional | IDE (Android Studio), Emulator (QEMU, Android SDK >=24) |

### iOS App

> [!WARNING]
> This project has no iOS platform thats why no more information

| Kind     | Minimums/Requirements |
| -------- | --------------------- |
| OS       | macOS (Darwin)        |
| Optional | IDE (Xcode)           |
