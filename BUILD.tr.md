## Yükleme/Derleme

### Varsayılan

1. **Depoyu Klonla**

```sh
git clone https://github.com/EnbloxC3/anitkabir-pusulasi.git
```

ya da

```sh
git clone https://gitlab.com/EnbloxC3/anitkabir-pusulasi.git
```

2. **Projeyi Hazırla**

```sh
npm ci
```

### Web

- Normal Derleme

```sh
npm run build
```

ya da

```sh
npm run build-web
```

- Önizleme

```sh
npm run run-web
```

> 'www' klasörünü kontrol edin

### Android

- Normal Derleme

```sh
npm run build-capacitor-android
```

- Önizleme

```sh
npm run run-android
```

- Android Uygulamasını Derleme

```sh
npm run build-android
```

ya da

```sh
npm run build-android -- --androidreleasetype aab
```

> Bunu imzalamanız gerekir

- Yayın Sürümünü Derleme

```sh
npm run release-build-android
```

ya da

```sh
npm run release-build-android -- --out aab
```

> Keystore gereksinimlerinizi girmeniz gerekir, bkz. [.env.example](.env.example)

### iOS

- Normal Derleme

```sh
npm run build-capacitor-ios
```

- Önizleme

```sh
npm run run-ios
```

- iOS Uygulamasını Derleme

```sh
npm run build-ios
```

> [!WARNING]
> Bu projede iOS platformu yok bu yüzden daha fazla bilgiye sahip değiliz
