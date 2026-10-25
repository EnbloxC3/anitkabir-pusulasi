import { Camera } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { App } from "@capacitor/app";
import {
  NativeSettings,
  AndroidSettings,
  IOSSettings,
} from "capacitor-native-settings";
import { DebugUI } from "./debug";
import { Capacitor } from "@capacitor/core";
import { Logger } from "./logger";
import str from "./string";
const channel = Logger.channel("compass");
const console = Logger.setProxy(channel);
const Cstr = str.common;
const Ostr = str.other;

const OK = Cstr.ok;
const SETTINGS = Cstr.settings;
const CANCEL = Cstr.cancel;
const EXIT = Cstr.exit;
const CLOSE = Cstr.close;
const CONTINUE = Cstr.continue;

async function openSettings() {
  if (Capacitor.getPlatform() === "android") {
    await NativeSettings.openAndroid({
      option: AndroidSettings.ApplicationDetails,
    });
  } else if (Capacitor.getPlatform() === "ios") {
    await NativeSettings.openIOS({ option: IOSSettings.App });
  } else if (Capacitor.getPlatform() === "web") {
    // ?
  }
}

const GeoUtils = {
  R: 6371e3,

  toRad: (deg) => (deg * Math.PI) / 180,
  toDeg: (rad) => (rad * 180) / Math.PI,

  calculateAzimuth(lat1, lon1, lat2, lon2) {
    const lat1Rad = this.toRad(lat1);
    const lat2Rad = this.toRad(lat2);
    const dLonRad = this.toRad(lon2 - lon1);

    const y = Math.sin(dLonRad) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLonRad);

    const brng = this.toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
  },

  calculateDistance(lat1, lon1, lat2, lon2) {
    const f1 = this.toRad(lat1);
    const f2 = this.toRad(lat2);
    const df = this.toRad(lat2 - lat1);
    const dl = this.toRad(lon2 - lon1);

    const a =
      Math.sin(df / 2) ** 2 +
      Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.R * c;
  },

  formatDistance(
    m,
    units = [
      [1000, Ostr.meter1000_i],
      [1, Ostr.meter1_i],
      [0.01, Ostr.meter0_01_i],
    ],
  ) {
    for (const [threshold, unit] of units) {
      if (m >= threshold) {
        const value = m / threshold;
        return `${value.toFixed(1)} ${unit}`;
      }
    }

    return `${Math.round(m)} ${Ostr.meter1_i}`;
  },
};

const RotUtils = {
  calculate(α, β, γ) {
    const matrix = this.createMatrix(α, β, γ);
    const top = this.transformVector(matrix, { x: 0, y: 1, z: 0 });
    const rear = this.transformVector(matrix, { x: 0, y: 0, z: -1 });
    return { matrix, top, rear };
  },
  createMatrix(alpha, beta, gamma) {
    const aRad = (alpha * Math.PI) / 180;
    const bRad = (beta * Math.PI) / 180;
    const gRad = (gamma * Math.PI) / 180;

    const sinA = Math.sin(aRad);
    const cosA = Math.cos(aRad);
    const sinB = Math.sin(bRad);
    const cosB = Math.cos(bRad);
    const sinG = Math.sin(gRad);
    const cosG = Math.cos(gRad);

    const rz = [
      [cosA, -sinA, 0],
      [sinA, cosA, 0],
      [0, 0, 1],
    ];
    const rx = [
      [1, 0, 0],
      [0, cosB, -sinB],
      [0, sinB, cosB],
    ];
    const ry = [
      [cosG, 0, sinG],
      [0, 1, 0],
      [-sinG, 0, cosG],
    ];

    const matrix = this.multiplyMatrices(this.multiplyMatrices(rz, rx), ry);
    return matrix;
  },
  transformVector(matrix, vector) {
    const values = [vector.x, vector.y, vector.z];
    const result = matrix.map((row) =>
      row.reduce((sum, value, index) => {
        return sum + value * values[index];
      }, 0),
    );
    return { x: result[0], y: result[1], z: result[2] };
  },
  multiplyMatrices(a, b) {
    const result = Array.from({ length: 3 }, () => [0, 0, 0]);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        for (let i = 0; i < 3; i++) {
          result[row][col] += a[row][i] * b[i][col];
        }
      }
    }
    return result;
  },
  projectHorizontal(vector) {
    return { x: vector.x, y: vector.y, z: 0 };
  },
  vectorToHeading(vector) {
    const angle = (Math.atan2(vector.x, vector.y) * 180) / Math.PI;
    return (angle + 360) % 360;
  },
  worldToLocal(matrix, vector) {
    return this.transformVector(this.transposeMatrix(matrix), vector);
  },
  transposeMatrix(matrix) {
    return matrix[0].map((_, col) => matrix.map((row) => row[col]));
  },
  azimuthToVector(azimuth) {
    const rad = (azimuth * Math.PI) / 180;
    return { x: Math.sin(rad), y: Math.cos(rad), z: 0 };
  },
  projectTargetToScreen(matrix, azimuth) {
    const worldTarget = this.azimuthToVector(azimuth);
    const localTarget = this.worldToLocal(matrix, worldTarget);
    const worldUp = { x: 0, y: 0, z: 1 };
    const localUp = this.worldToLocal(matrix, worldUp);
    return this.screenDirection(localTarget, localUp);
  },
  screenDirection(vector, localUp) {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    const pitchSin = localUp ? Math.abs(localUp.y) : 0;
    const pitchCos = Math.sqrt(Math.max(0, 1 - pitchSin * pitchSin));
    const screenX = x;
    const screenY = y * pitchCos - z * pitchSin;
    const length = Math.hypot(screenX, screenY);
    if (length === 0) return { x: 0, y: 0, z: z };

    return { x: screenX / length, y: screenY / length, z: z };
  },
};

class CameraManager {
  constructor(videoElement, viewElement, onError) {
    this.video = videoElement;
    this.view = viewElement;
    this.onError = onError;

    this.lastErrorKey = null;
    this.permissionRequest = null;

    this.stream = null;
    this.track = null;

    this.isActive = false;
    this.targetState = false;
    this.timeout = null;
    this.isProcessing = false;

    this._statusbar = window.__statusBarState;
    this.subchannel = channel.addChannel("CameraManager");

    this.listeners = {
      visibility: null,
      pause: null,
      trackEnded: null,
    };

    this.initListeners();
  }

  async initListeners() {
    if (this.listeners.visibility || this.listeners.pause) return;
    this.listeners.visibility = () => {
      if (document.visibilityState === "hidden") {
        this.updateState(false);
      }
    };
    this.listeners.pause = () => {
      this.updateState(false);
    };

    document.addEventListener("visibilitychange", this.listeners.visibility);
    this.video.on("pause", this.listeners.pause);
    channel.info("Listeners inited", this.subchannel);
  }

  updateState(shouldBeActive) {
    if (shouldBeActive === this.targetState) return;

    this.targetState = shouldBeActive;

    channel.debug(
      `Target state updated: %c${shouldBeActive}`,
      this.subchannel,
      ["color: blue;"],
    );

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    this.timeout = setTimeout(() => {
      this.timeout = null;
      this.applyState();
    }, 600);
  }

  async applyState() {
    if (this.isProcessing) return;
    if (this.targetState === this.isActive) return;

    this.isProcessing = true;
    const desired = this.targetState;

    try {
      if (desired) {
        await this.start();
      } else {
        await this.stop();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  handleError(e) {
    const errorKey = e.cause || e.message || "unknown";
    if (this.lastErrorKey === errorKey) {
      return;
    }

    this.lastErrorKey = errorKey;
    this.onError?.(e);
  }

  async requestCameraPermission() {
    if (this.permissionRequest) return this.permissionRequest;

    this.permissionRequest = (async () => {
      if (Capacitor.isNativePlatform()) {
        return Camera.requestPermissions({
          permissions: ["camera"],
        });
      }
      if (navigator.mediaDevices?.getUserMedia)
        return { camera: "native-unrequestable" };
      else return { camera: "unsupported" };
    })();

    try {
      return await this.permissionRequest;
    } finally {
      this.permissionRequest = null;
    }
  }

  async start() {
    if (this.stream) return;
    try {
      const permissions = await Camera.checkPermissions();
      let perm = permissions.camera;

      if (perm !== "granted") {
        const runtimePermission = await this.requestCameraPermission();
        perm = runtimePermission.camera;
      }
      if (perm !== "granted" && perm !== "native-unrequestable") {
        if (perm === "unsupported")
          throw new Error("MediaDevices not supported.", {
            cause: "permission_unsupported",
          });
        throw new Error("Camera permission wasn't given.", {
          cause: "permission_denied",
        });
      }
      if (!this.targetState) return;
      const stream = await navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        })
        .catch((e) => {
          if (e.name === "NotAllowedError")
            throw new Error("Camera permission wasn't given.", {
              cause: "permission_denied",
            });
          else
            throw new Error("Unknown camera error.", {
              cause: e,
            });
        });

      if (!this.targetState) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.stream = stream;
      this.track = stream.getVideoTracks()[0];
      this.listeners.trackEnded = () => {
        this.stop();
      };

      this.track.addEventListener("ended", this.listeners.trackEnded);

      this.video[0].srcObject = stream;
      this.isActive = true;
      await new Promise((resolve) => {
        this.video.once("loadeddata", resolve);
      });
      this.view.addClass("active");
      this._statusbar?.hiddenForReasons?.add("camera");
      this.lastErrorKey = null;
    } catch (e) {
      this.isActive = false;
      this.stream = null;
      this.track = null;

      this.handleError(e);
    }
  }

  async stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    this._statusbar?.hiddenForReasons?.delete("camera");

    if (this.view.hasClass("active")) {
      await new Promise((resolve) => {
        this.view.transitionEnd(resolve);
        this.view.removeClass("active");
      });
    }

    this.isActive = false;

    const track = this.track;
    const stream = this.stream;
    this.track = null;
    this.stream = null;

    if (track && this.listeners.trackEnded) {
      track.removeEventListener("ended", this.listeners.trackEnded);
      this.listeners.trackEnded = null;
    }

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    if (this.video[0]) {
      this.video[0].srcObject = null;
    }
  }

  destroy() {
    this.stop();

    if (this.listeners.visibility) {
      document.removeEventListener(
        "visibilitychange",
        this.listeners.visibility,
      );
      this.listeners.visibility = null;
    }

    if (this.listeners.pause) {
      this.video.off("pause", this.listeners.pause);
      this.listeners.pause = null;
    }
  }
}

// -- v1.0.0 --
// Wave1
// * FIXME: İzin verilmediğnde kamera modu sürekli dialog çıkartıyor (çözüldü, handleError ile error deduplication, requestCameraPermission ile native dialog deduplication yapıldı ayrıca bazı spesifik durumlar için start'ın başındaki kontrolleri yeniledim) i.b: CameraManager: handleError, requestCameraPermission, start
// * TODO: Pusulayı hem düz hem dik yüzeyde stabil hale getir, (bu kısmı sonradan yazdım)"AR için ayrı bir hesaplama bandı kur, ikisine de gelen veri için ortak bir hesaplama kullan ve bunları daha sonra türet" (çözüldü, diğer TODO'da açıklaması var), i.b: handleOrientation
// * TODO: Beta hesaplamasınıda katarak kamera modunda iyileştirmelere git (aslında beta veya kamera yerine direkt RotUtils diye ayrı bir sınıf oluşturdum ve burda çok şey öğrendim, kesinlikle kusursuz değil ve biraz daha kurcalarsam çalışan şeye zarar vereceğimi düşünmeye başladım o yüzden şuanki haliyle bırakıyorum, ilerisine bakarız) i.b: handleOrientation, RotUtils
// * FIXME: küçük cihazlar ve yatay moddaki tasarımsal hatalar duzelt (çözüldü, hem pusulanın her boyutta olabildiğince düzgün görünmesini sağladım hemde split view özelliği ekledim; içerik 500px yüksekliğin altında iken (genelde çok küçük cihazlar ya da landscape) split view devreye giriyor güzel oldu) i.b: css/compass.css, css/menu.css; @media, setupUIEvents.setupSplitMenu, capactior-app.js; handleStatusBar.updateVisibility (küçük değişiklik)
// * FIXME: statusbar safe area ile ilgili sorunlar var duzelt (çözüldü, ana sorun aslında üstten açılan sheet menüsündeydi ve css top padding'i safe area top ayarlayarak çözdüm) i.b: css/menu.css #settings-sheet
// * TODO: statusbar kamera modunda gizlenecek (dümdüz gizlemedim öyle olsa kötü görünürdü bu yüzden sebeb sentez sistemi yaptım (capacitor-app.js içinde)) i.b: CameraManager._statusbar, capacitor-app.js
// * FIXME: hareket sensörü anlamsız bir şekilde çalışmayı durdurdu (live update yüzündenmiş safe origin olmadığı için) i.b: "npx cap run -l", https://developer.mozilla.org/en-US/docs/Web/API/Window/deviceorientation_event (Secure context)
// * FIXME: kamera sebepsizce düz yüzeyde açılıyor (kendi telefonuma özel bir durum olduğunu düşündüm (çünkü emülatörde doğru çalışıyordu) ama state senkronizasyonu kilidi ile çözdüm) i.b: CameraManager; updateState, applyState
// * FIXME: siren butonu uppercase türkçe karakter sorunu (lang=tr ile çözüldü, localeUpperCase denen birşeyi öğrendim) i.b: app.f7, css/menu.css .siren-btn (ilgili bölüm değişti)
// * FIXME: kamera video stream transition efektinden önce kapanıyor (active sınıfının kaldırılması ile oluşan transition efektinden önce stream kapanıyordu bunu Dom7'nın transitionEnd metodu ile çözdüm bkz. https://framework7.io/docs/dom7.html#method-.transitionEnd(callback,%20permanent) ) i.b: CameraManager.stop, css/cam.css #cameraView
// * FIXME: kamera modu açıldığında sayfa Root'a olmasa bile veya bir overlay (sheet, toast, dialog, popup, popover) açık olsa bile status bar gizleniyor (zaten sebep senteziyle çözdüm bunu) i.b: CameraManager._statusbar, capacitor-app.js
// * FIXME: kalibirasyon butonunun bir özelliği yok (düzdeltene kadar bir özelliği yoktu hatta kodun eski özelliklerini kullanıyordu, düzelttim, ancak bence hala o kadar işlevsel değil) i.b: setupUIEvents: this.el.permBtn.on(...
// Wave2
// * FIXME: splitView ayar butonu (.page-main .navbar .link) rengi sorunu (beyaz modda görünmez oluyordu artık onun yerine tema rengine ayak uyduruyor, framework7 css özelliklerini burda çok zorladım ama sonuç istediğim gibi) i.b: app.f7 .page-main .navbar .link, css/menu.css @media
// * FIXME: splitView statusbar ve safe area sorunu (statusbar gizleniyor ama kullanıcı bilinçli bir şekilde aşağı kaydırıp açmaya çalışırsa #openCompass ve ayar butonu (.page-main .navbar .link) güvenli bölgeden taşıp kötü bir görünüme sebep oluyordu düzelttim) i.b: css/menu.css @media .page-main
// * FIXME: splitView kamera modunda ayar butonu ve FAB görsel hataları (yazarken direkt başına * koydum anında çözdüm) i.b: css/menu.css: @media, css/cam.css: #cameraView
// Wave3
// * TODO: açık kaynak ve üçüncü taraf yazılımları gösteren bir sayfa ve lisans gösterimi (çok güzel oldu hatta pusuladan daha çok kastım burayı uygulamanın ana amacından bile daha iyi) i.b: components/dependencies/*, pages/dependencies.f7
// * TODOOPTIONAL: ikon font yönetimi artık daha düzenli i.b: fonts/, css/icons.css
// * TODOOPTIONAL: ince ayarlı bazı optimizasyonlar (özellikle pusula tarafındaki optimizasyonlar iş yükünü azaltıp performans sağlıyor arayüz akıcı hale geliyor, bazı bileşenlerde hala kasma sorunu yaşanıyor) i.b: Compass
// * TODOOPTIONAL: üsttekine atıf olarak pusula render fonksiyonu kör bir frame döngüsünden çıkıp yönetilebilir bir döngüye çevrildi performansa dahildir i.b: startRenderLoop, stopRenderLoop
// * TODOOPTIONAL: erişilebilirlik geliştirmesi i.b: pages/*/*.f7: all(.item-link), components/*/*.f7: all(.item-link), css/native.css, setupOther: talkbackConf
// FIXMEOPTIONAL: dependencyList bileşeninin performans için virtual list (https://framework7.io/docs/virtual-list.html) kullanması daha etkili olur ancak arama entegrasyonu için ekstrada mühendisliğe ihtiyaç duymadım zaten onun haricinde olabildiğince optimize etmeye çalıştım
// FIXME app.js içinde "FIXMEIFYOUCAN"
// * -- beta.1 end of bundle (completed) --
// Wave4
// * FIXME: kamera web'de açılmıyor (Camera.requestPermissions implement sınırına takılıyor, isNativePlatform ile kontrol edip "native-unrequestable" diye özel bir permission durumu döndürüyoruz, sonra klasik izin mekanizmasında bu durumu aynı granted gibi ignore edip kodu devam ettiriyoruz sonra izin işini getUserMedia'ya bırakıyoruz, "unsupport" ile birazda hata yönetimi) i.b: CameraManager: start, requestCameraPermission; Compass.camera instanceof *: 3 (onError)
// Wave5
// TODO: link Open Graph
// FIXME: Bulunmayı bekleyen nadir hatalar
// -- beta.2 end of bundle (uncompleted) --
// -- beta.3 end of bundle (queue) --
// -- v1.0.1 --
// ? (*.*.0 uncompleted)
// ---------------------------------------
// ? Çözümleri detaylı yazmadım nasıl çözdüğüme ilgili bölümlerden bakabilirsiniz
// ? *: solved/complete; --: each bundle end/each version start; ?(descriptions): description; ?(syntax): info; !(descriptions): warning; //Wave*: each maintain session; //-*31: split
// ? TODOOPTIONAL=DEVLOG
// ? FIXMEOPTIONAL=Optional fix
// ! Bundan çok daha fazla sorun elbette var ancak bu proje artık benim için bir anlam ifade etmiyor bu yüzden daha fazla uğraşmak istemiyorum
// ! README'de zaten yeterince açıklama var

class Compass {
  constructor(elements, app, target, options = {}) {
    this.el = elements;
    this.app = app;
    this.$ = app.$;

    this.TARGET = target;
    this.FOV_H = options.FOV_H || 60;

    this.state = options.state || {
      lat: null,
      lon: null,
      azimuth: 0,
      //heading: 0,
      orientation: {
        alpha: null,
        beta: null,
        gamma: null,
        matrix: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
        top: { x: 0, y: 1, z: 0 },
        rear: { x: 0, y: 0, z: -1 },
      },
      distance: 0,
      isFlat: false,
      isSirenPlaying: false,
    };

    //this.tiltOffset = 0;
    this.subchannel = channel.addChannel("Compass", "#e30a17");

    this.camera = new CameraManager(this.el.video, this.el.cameraView, (e) => {
      channel.important(`Camera Init Error: %c${e.message}`, this.subchannel, [
        "color: orangered;",
      ]);
      let permError = e.cause === "permission_denied";
      if (e.cause === "permission_unsupported") return;
      this.app.dialog
        .create({
          title: permError ? Ostr.permission_needed : Ostr.camera_error,
          text: permError ? Ostr.camera_permission_needed : Ostr.unknown_error,
          buttons: [
            { text: OK },
            ...(Capacitor.isNativePlatform() && permError
              ? [{ text: SETTINGS, bold: true, onClick: openSettings }]
              : []),
          ],
        })
        .open();
    });

    this.orientationListener = null;

    this.handleOrientation = this.handleOrientation.bind(this);
    this.handleGeolocation = this.handleGeolocation.bind(this);
    this.render = this.render.bind(this);

    this.rendering = false;
    this.renderFrame = null;
  }

  log(message, level, styles) {
    channel[level ?? "info"](message, this.subchannel, styles);
  }
  // * (-: init start, +: init end/user reaction end, *: user reaction start, ?: event reaction start, (:): event reaction end/reaction result(if exist), !: error)
  // * blue: bool, orange: int, orangered: str, cyan: object, lightblue: enum, violet: refer, green: path, darkkhaki: key

  init() {
    this.log("Initializing...");
    this.setupTheme();
    this.setupSiren();
    this.setupSensors();
    if (import.meta.env.VITE_DEBUG_UI === "true") this.setupDebugPopover();
    this.setupUIEvents();
    this.setupOther();
    this.startRenderLoop();
    this.log("Initied");
  }

  setupTheme() {
    this.log("setupTheme -", "initial");
    const $$ = this.$;
    const savedPref = localStorage.getItem("prefersColorScheme") || "auto";
    let usingPref = null;

    const setThemeMode = (mode) => {
      if (usingPref === mode) return;
      mode = mode || usingPref || savedPref || "auto";

      if (
        mode === "light" ||
        (mode === "auto" && this.app.device.prefersColorScheme() === "light")
      )
        this.app.setMdColorScheme("vibrant");
      else this.app.setMdColorScheme("default");
      this.app.setDarkMode({ dark: true, light: false, auto: "auto" }[mode]);
      localStorage.setItem("prefersColorScheme", mode);
      usingPref = mode;
      $$("#theme-segment .button")
        .removeClass("button-active")
        .filter((el) => $$(el).data("value") === mode)
        .addClass("button-active");
      $$(`meta[name="theme-color"]`).attr(
        "content",
        getComputedStyle(document.documentElement)
          .getPropertyValue(
            this.app.device.desktop ? "--f7-bars-bg-color" : "--f7-theme-color",
          )
          .trim(),
      );
      this.log(`setThemeMode *: %c${mode}`, "debug", ["color: lightblue;"]);
    };

    setThemeMode();

    $$("#theme-segment .button").on("click", function () {
      setThemeMode($$(this).data("value"));
    });

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (localStorage.getItem("prefersColorScheme") === "auto")
          setThemeMode();
      });

    this.log("setupTheme +", "success");
  }

  async setupSensors() {
    this.log("setupSensors -", "initial");
    let isWeb;
    const permissionNeededDialog = (isWeb) => {
      this.app.dialog
        .create({
          title: Ostr.permission_needed,
          text: Ostr.location_permission_needed,
          buttons: !isWeb
            ? [
                {
                  text: `${CANCEL}${
                    this.app.device.android ? ` (${EXIT})` : ""
                  }`,
                  onClick: () => App.exitApp(),
                },
                {
                  text: SETTINGS,
                  bold: true,
                  onClick: openSettings,
                },
              ]
            : [{ text: OK }],
          on: {
            close: async () => {
              if (!isWeb) {
                App.exitApp();
              } else {
                const permission = await navigator.permissions.query({
                  name: "geolocation",
                });
                if (permission.state === "denied")
                  this.app.toast
                    .create({
                      text: Ostr.no_perm_no_access,
                      position: "bottom",
                      closeTimeout: 30000,
                    })
                    .open();
                this.setupSensors();
                return;
              }
            },
          },
        })
        .open();
    };

    try {
      const perm = await Geolocation.requestPermissions();
      isWeb = false;

      if (perm.location !== "granted") {
        permissionNeededDialog();
        return;
      }
    } catch (e) {
      if (e.message === "Not implemented on web.") {
        isWeb = true;
      }
    }

    const errorBehaviour = (e) => {
      if (e.message === "User denied Geolocation")
        permissionNeededDialog(isWeb);
      else {
        this.app.dialog.alert(Ostr.unknown_error, Ostr.geolocation_error);
        this.log(`Geolocation error: %c${e.message}`, "important", [
          "color: orangered;",
        ]);
      }
    };

    this.app.preloader.show();
    const firstpos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 6e4,
    }).catch((e) => {
      errorBehaviour(e);
      return;
    });
    this.app.preloader.hide();
    if (!firstpos) return;
    this.handleGeolocation(firstpos);

    Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        maximumAge: 1e4,
        minimumUpdateInterval: 500,
        timeout: 6e4,
      },
      (pos, err) => {
        if (err) {
          errorBehaviour(err);
          return;
        }
        this.handleGeolocation({
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
        });
      },
    );

    this.setupOrientation();
    this.log("setupSensors +", "success");
  }

  async setupOrientation() {
    this.log("setupOrientation -", "initial");

    try {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const perm = await DeviceOrientationEvent.requestPermission();

        if (perm !== "granted") {
          this.app.dialog
            .create({
              title: Ostr.permission_needed,
              text: Ostr.orientation_permission_needed,
              buttons: [
                {
                  text: CANCEL,
                  onClick: Capacitor.isNativePlatform()
                    ? () => App.exitApp()
                    : () => {},
                },
                {
                  text: Capacitor.isNativePlatform()
                    ? SETTINGS
                    : Ostr.goto_browser_settings,
                  bold: true,
                  onClick: Capacitor.isNativePlatform()
                    ? openSettings
                    : () => {
                        this.app.dialog
                          .create({
                            title: Ostr.site_settings,
                            text: ` <div class="list simple-list no-margin"> <ul> <li> <a class="external" target="_blank" href="https://support.google.com/chrome/answer/114662"> Chrome </a> </li> <li> <a class="external" target="_blank" href="https://support.microsoft.com/tr-tr/edge/location-and-privacy-in-microsoft-edge"> Microsoft Edge </a> </li> <li> <a class="external" target="_blank" href="https://support.mozilla.org/en-US/kb/site-permissions-panel"> Firefox </a> </li> <li> <a class="external" target="_blank" href="https://support.apple.com/guide/iphone/browse-the-web-privately-iphb01fc3c85/27/ios/27"> Safari </a> </li> </ul> </div> `,
                            buttons: [{ text: CLOSE, bold: true }],
                          })
                          .open();
                      },
                },
              ],
              verticalButtons: true,
            })
            .open();

          return;
        }
      }
      if (this.orientationListener) {
        window.removeEventListener(
          "deviceorientationabsolute",
          this.orientationListener,
        );
        window.removeEventListener(
          "deviceorientation",
          this.orientationListener,
        );
      }

      let receivedValidEvent = false;
      this.orientationListener = (event) => {
        if (
          !Number.isFinite(event.alpha) ||
          !Number.isFinite(event.beta) ||
          !Number.isFinite(event.gamma)
        ) {
          return;
        }
        receivedValidEvent = true;
        this.handleOrientation(event);
      };
      if ("ondeviceorientationabsolute" in window) {
        window.addEventListener(
          "deviceorientationabsolute",
          this.orientationListener,
        );
      } else {
        window.addEventListener("deviceorientation", this.orientationListener);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!receivedValidEvent) {
        throw new Error("Orientation sensor returned no valid data.", {
          cause: "invalid_arguments",
        });
      }
    } catch (e) {
      this.log(`setupOrientation !: %c${e.message}`, "error", [
        "color: orangered;",
      ]);
      this.app.dialog.alert(Ostr.orientation_not_supported);
    }
    this.log("setupOrientation +", "success");
  }

  handleGeolocation(pos) {
    this.log("handleGeolocation ?", "debug");
    const { latitude, longitude } = pos.coords;
    this.state.lat = latitude;
    this.state.lon = longitude;

    this.state.azimuth = GeoUtils.calculateAzimuth(
      latitude,
      longitude,
      this.TARGET.lat,
      this.TARGET.lon,
    );
    this.state.distance = GeoUtils.calculateDistance(
      latitude,
      longitude,
      this.TARGET.lat,
      this.TARGET.lon,
    );
    this.log(`handleGeolocation : %c${latitude} ${longitude}`, "debug", [
      "color: orange;",
    ]);
  }

  handleOrientation(e) {
    this.log("handleOrientation ?", "debug");
    const { alpha, beta, gamma } = e;

    if (
      typeof alpha !== "number" ||
      typeof beta !== "number" ||
      typeof gamma !== "number"
    ) {
      this.log(
        `handleOrientation : %cInvalid orientation values. (${alpha}, ${beta}, ${gamma})`,
        "important",
        ["color: orangered;"],
      );
      return;
    }

    const orientation = RotUtils.calculate(alpha, beta, gamma);
    this.state.orientation = {
      alpha,
      beta,
      gamma,
      ...orientation,
    };

    const isVertical = beta > 45 && beta < 135;
    this.state.isFlat = !isVertical;
    this.camera.updateState(isVertical);
    this.log(`handleOrientation : %c${alpha} ${beta} ${gamma}`, "debug", [
      "color: orange;",
    ]);
  }

  startRenderLoop() {
    if (this.rendering) return;
    this.rendering = true;
    this.renderFrame = requestAnimationFrame(this.render);
  }

  stopRenderLoop() {
    this.rendering = false;
    if (this.renderFrame !== null) {
      cancelAnimationFrame(this.renderFrame);
      this.renderFrame = null;
    }
  }

  render() {
    const distStr = GeoUtils.formatDistance(this.state.distance);
    const distBadgeText = `${str.pages.home.distance}: ${distStr}`;

    if (this.renderState?.distBadge !== distBadgeText) {
      this.el.distBadge.text(distBadgeText);
      this.renderState ??= {};
      this.renderState.distBadge = distBadgeText;
    }
    if (this.renderState?.arDistLabel !== distStr) {
      this.el.arDistLabel.text(distStr);
      this.renderState ??= {};
      this.renderState.arDistLabel = distStr;
    }
    const northVector = RotUtils.projectTargetToScreen(
      this.state.orientation.matrix,
      0,
    );
    const northLocalDeg =
      (Math.atan2(northVector.x, northVector.y) * 180) / Math.PI;
    const northTransform = `rotate(${northLocalDeg}deg)`;

    if (this.renderState?.cardTransform !== northTransform) {
      this.el.card.transform(northTransform);
      this.renderState ??= {};
      this.renderState.cardTransform = northTransform;
    }
    const targetVector = RotUtils.projectTargetToScreen(
      this.state.orientation.matrix,
      this.state.azimuth,
    );
    const targetLocalDeg =
      (Math.atan2(targetVector.x, targetVector.y) * 180) / Math.PI;
    const needleTransform = `rotate(${targetLocalDeg}deg)`;

    if (this.renderState?.needleTransform !== needleTransform) {
      this.el.needle.transform(needleTransform);
      this.renderState ??= {};
      this.renderState.needleTransform = needleTransform;
    }
    const azText = `${Math.round(this.state.azimuth)}°`;

    if (this.renderState?.azText !== azText) {
      this.el.azText.text(azText);
      this.renderState ??= {};
      this.renderState.azText = azText;
    }
    if (this.camera.isActive) {
      const arHeading = RotUtils.vectorToHeading(
        RotUtils.projectHorizontal(this.state.orientation.rear),
      );

      this.renderAR(arHeading);
    }

    if (this.rendering) {
      this.renderFrame = requestAnimationFrame(this.render);
    }
  }

  renderAR(arHeading) {
    let delta = this.state.azimuth - arHeading;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const halfFov = this.FOV_H / 2;
    const inView = Math.abs(delta) <= halfFov;
    this.renderState ??= {};
    if (inView) {
      const percent = ((delta + halfFov) / this.FOV_H) * 100;

      if (this.renderState.tapeDisplay !== "flex") {
        this.el.tapeMarker.css("display", "flex");
        this.renderState.tapeDisplay = "flex";
      }
      const left = `${percent}%`;

      if (this.renderState.tapeLeft !== left) {
        this.el.tapeMarker.css("left", left);
        this.renderState.tapeLeft = left;
      }
      if (this.renderState.arrowLeftDisplay !== "none") {
        this.el.arrowLeft.hide();
        this.renderState.arrowLeftDisplay = "none";
      }
      if (this.renderState.arrowRightDisplay !== "none") {
        this.el.arrowRight.hide();
        this.renderState.arrowRightDisplay = "none";
      }
    } else {
      if (this.renderState.tapeDisplay !== "none") {
        this.el.tapeMarker.hide();
        this.renderState.tapeDisplay = "none";
      }
      const isLeft = delta < 0;
      const leftDisplay = isLeft ? "flex" : "none";
      const rightDisplay = isLeft ? "none" : "flex";

      if (this.renderState.arrowLeftDisplay !== leftDisplay) {
        this.el.arrowLeft.css("display", leftDisplay);
        this.renderState.arrowLeftDisplay = leftDisplay;
      }
      if (this.renderState.arrowRightDisplay !== rightDisplay) {
        this.el.arrowRight.css("display", rightDisplay);
        this.renderState.arrowRightDisplay = rightDisplay;
      }
    }
  }

  async setupSiren() {
    this.log("setupSiren -", "initial");
    const $$ = this.$;
    const muteToggle = $$("#toggle-mute");

    const AuSource = document.createElement("source");

    if (this.el.sirenAudio[0].canPlayType("audio/ogg; codecs=opus")) {
      const { default: siren } = await import("../assets/siren.opus");
      AuSource.src = siren;
      AuSource.type = "audio/ogg; codecs=opus";
    } else {
      const { default: siren } = await import("../assets/siren.mp3");
      AuSource.src = siren;
      AuSource.type = "audio/mpeg";
    }

    this.el.sirenAudio.append(AuSource);
    this.el.sirenAudio[0].load();

    if (localStorage.getItem("sirenMute") === "true") {
      muteToggle.prop("checked", true);
    }

    muteToggle.on("change", (e) => {
      localStorage.setItem("sirenMute", e.target.checked);
      this.log(`muteToggle(change) *: %c${e.target.checked}`, "debug", [
        "color: blue;",
      ]);
    });

    this.el.sirenBtn.on("click", () => this.toggleSiren());
    this.el.sirenAudio.on("ended", () => this.stopSiren(true));
    this.log("setupSiren +", "success");
  }

  toggleSiren() {
    this.log("toggleSiren *", "debug");
    if (this.state.isSirenPlaying) {
      this.stopSiren();
    } else {
      if (localStorage.getItem("sirenMute") === "true") {
        return this.app.dialog.alert(Ostr.silent_mode_on);
      }
      this.confirmAndPlaySiren();
    }
    this.log("playSiren +", "debug");
  }

  confirmAndPlaySiren() {
    const dontShow = localStorage.getItem("sirenDontShowAgain") === "true";
    if (dontShow) {
      this.playSiren();
      return;
    }

    const dialog = this.app.dialog.create({
      title: Ostr.get_ready,
      text: `
    <p>${Ostr.get_ready_continue}</p>

    <label style="
      display: flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
    ">
      <span class="checkbox">
        <input type="checkbox">
        <i class="icon icon-checkbox"></i>
      </span>
      <span>${Ostr.dont_show_again}</span>
    </label>
  `,
      buttons: [
        {
          text: CANCEL,
          color: "red",
        },
        {
          text: CONTINUE,
          bold: true,
          onClick: () => {
            if (dialog.$el.find('input[type="checkbox"]').prop("checked")) {
              localStorage.setItem("sirenDontShowAgain", "true");
            }

            this.playSiren();
          },
        },
      ],
    });

    dialog.open();
  }

  playSiren() {
    this.log("playSiren *", "debug");
    this.state.isSirenPlaying = true;

    this.el.sirenAudio[0]
      .play()
      .then(() => {
        this.el.sirenBtn.addClass("playing");
        this.el.sirenBtn.find(".siren-text").text(Ostr.stop_siren);
        this.el.sirenBtn.find(".siren-icon-start").hide();
        this.el.sirenBtn.find(".siren-icon-stop").show();
      })
      .catch((e) => {
        this.app.dialog.alert(Ostr.sound_error);
        this.log(`playSiren !: %c${e.message}`, "error", ["color: orangered;"]);
      });
    this.log("playSiren +", "debug");
  }

  stopSiren(finished = false) {
    this.log("stopSiren *: %c" + finished, "debug", ["color: blue;"]);
    this.el.sirenAudio[0].pause();
    this.el.sirenAudio[0].currentTime = 0;
    this.state.isSirenPlaying = false;
    this.el.sirenBtn.removeClass("playing");
    this.el.sirenBtn.find(".siren-text").text(str.pages.home.siren);
    this.el.sirenBtn.find(".siren-icon-start").show();
    this.el.sirenBtn.find(".siren-icon-stop").hide();

    if (finished) {
      setTimeout(() => this.app.dialog.alert(Ostr.memorialize), 1000);
    }
    this.log("stopSiren +", "debug");
  }

  setupDebugPopover() {
    new DebugUI(this.app, this.state);
    this.log(
      `Debug UI setted with state %c${JSON.stringify(this.state)}`,
      "info",
      ["color: cyan;"],
    );
  }

  setupUIEvents() {
    this.log("setupUIEvents -", "initial");
    const $$ = this.$;
    let calibrating = false;
    this.el.permBtn.on("click", () => {
      if (calibrating == true) return;
      calibrating = true;
      this.setupOrientation();
      const toast = this.app.toast.create({
        text: Ostr.calibrating,
        closeTimeout: 2000,
        on: { closed },
      });

      toast.on("closed", () => {
        calibrating = false;
      });
      toast.open();
    });
    this.el.refBtn.on("click", () => {
      window.location.reload();
    });
    const setupSplitMenu = () => {
      const views = $$("div.compass-container, div.control-grid");
      const toggleSplit = () => views.toggleClass("fulldeactive");
      this.el.fabControlButtons.on("click", () => {
        toggleSplit();
        sessionStorage.setItem(
          "splitMenu",
          $$(views[0]).hasClass("fulldeactive") ? "1" : "0",
        );
      });
      const splitViewQuery = window.matchMedia("(max-height: 500px)");
      const updateSplitViewStatusBar = (e) => {
        const reasons = window.__statusBarState?.hiddenForReasons;
        if (!reasons) return;
        if (e.matches) {
          reasons.add("splitView");
        } else {
          reasons.delete("splitView");
        }
      };
      updateSplitViewStatusBar(splitViewQuery);
      splitViewQuery.addEventListener("change", updateSplitViewStatusBar);
    };

    setupSplitMenu();

    window.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });
    window.addEventListener("drag", function (e) {
      e.preventDefault();
    });
    window.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
    this.log("setupUIEvents +", "success");
  }

  setupOther() {
    const $$ = this.$;

    this.app.on("pageBeforeIn", (page) => {
      if (page.name === "home") {
        if (!this.rendering) this.startRenderLoop();
      } else {
        if (this.rendering) this.stopRenderLoop();
      }
    });

    const talkbackConf = () => {
      const configure = () => {
        $$("i").attr("aria-hidden", "true");
        $$("a.item-link .item-inner").each((link) => {
          const $link = $$(link);
          const text = $link.find(".item-title").text().trim();

          if (text) $link.attr("aria-label", text);
        });
      };

      configure(document.body);
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(({ addedNodes }) => {
          addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) configure(node);
          });
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
    };
    talkbackConf();
  }
}

channel.info("Compass here!");

export { Compass };
