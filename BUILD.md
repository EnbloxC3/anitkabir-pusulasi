## Installing/Building

### Default

1. **Clone repository**

```sh
git clone https://github.com/EnbloxC3/anitkabir-pusulasi.git
```

or

```sh
git clone https://gitlab.com/EnbloxC3/anitkabir-pusulasi.git
```

2. **Init Project**

```sh
npm ci
```

### Web

- Normal Build

```sh
npm run build
```

or

```sh
npm run build-web
```

- Preview

```sh
npm run run-web
```

> Check the 'www' dir

### Android

- Normal Build

```sh
npm run build-capacitor-android
```

- Preview

```sh
npm run run-android
```

- Build Android App

```sh
npm run build-android
```

or

```sh
npm run build-android -- --androidreleasetype aab
```

> You need to sign it

- Release Build

```sh
npm run release-build-android
```

or

```sh
npm run release-build-android -- --out aab
```

> You need to enter your keystore requirements see [.env.example](.env.example)

### iOS

- Normal Build

```sh
npm run build-capacitor-ios
```

- Preview

```sh
npm run run-ios
```

- Build iOS App

```sh
npm run build-ios
```

> [!WARNING]
> This project has no iOS platform thats why no more information
