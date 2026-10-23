import $ from "dom7";
import Framework7, { getDevice } from "framework7/bundle";
import strings from "./string";

// Import F7 Styles
import "framework7/css/bundle";
/*import "framework7/css/bundle/rtl";*/ // FIXMEIFYOUCAN: cannot using these two (ltr, rtl) css' dynamically without a flashs of unstyled content cause of lazy or after content load OR these css' are overriding app custom css' at the point

/*
import lcss from "framework7/css/bundle?inline";
import rcss from "framework7/css/bundle/rtl?inline";

$("<style>")
  .text(strings.internal.dir === "rtl" ? rcss : lcss)
  .appendTo("head");
*/ // ? CAUSES: Overriding specific component styles

/*
const stylesheets = {
  ltr: () => import("framework7/css/bundle"),
  rtl: () => import("framework7/css/bundle/rtl"),
};

await stylesheets[strings.internal.dir]();
*/ // ? CAUSES: FOUC (flash of unstyled content) and overriding component styles

// Import Icons and App Custom Styles
import "@/css/main.css";

// Import Capacitor APIs
import capacitorApp from "./capacitor-app";
// Import Routes
import routes from "./routes";

// Import main app component
import App from "@/app.f7";
import { Logger } from "./logger";

let pn = performance.now();

var device = getDevice();
var darkMode =
  { dark: true, light: false, auto: "auto" }[
    localStorage.getItem("prefersColorScheme")
  ] ?? "auto";
var app = new Framework7({
  name: strings.app.name, // App name
  theme: "auto", // Automatic theme detection
  colors: {
    primary: "#e30a17",
  },
  el: "#app", // App root element
  component: App, // App main component
  // App routes
  routes: routes,
  view: {
    url: "/",
    transition: "f7-parallax",
    removeElements: true,
    // heres a logic
    // This apps main page should not removed from DOM!! (cuz its directly manager of view and first (dom element) initialize point)
    // but F7 removes (and caches) page components after 2> route history
    // so WE use master-details' immortal master pages!
    // we dont use master details' real intent, we use master page logic
    // after chaning breakpoint to a impossible screen size
    masterDetailBreakpoint: Number.MAX_SAFE_INTEGER,
  },
  // Input settings
  input: {
    scrollIntoViewOnFocus: device.capacitor,
    scrollIntoViewCentered: device.capacitor,
  },
  // Capacitor Statusbar settings
  statusbar: {
    iosOverlaysWebView: true,
    androidOverlaysWebView: true,
  },
  dialog: {
    buttonOk: strings.common.ok,
    buttonCancel: strings.common.cancel,
    keyboardActions: true,
  },
  toast: {
    closeTimeout: 3000,
  },
  panel: {
    swipe: true,
  },
  darkMode,
  mdColorScheme:
    !darkMode ||
    (darkMode === "auto" && device.prefersColorScheme() === "light")
      ? "vibrant"
      : "default",
  touch: {
    touchHighlight: getDevice().ios,
  },
  on: {
    init: function () {
      var f7 = this;
      if (f7.device.capacitor) {
        // Init capacitor APIs (see capacitor-app.js)
        capacitorApp.init(f7);
      }
    },
  },
});

let npn = performance.now() - pn;
Logger.channel("app").info(
  `App instance initialized in %c${npn.toFixed(1)} ms`,
  null,
  ["color: blue;"],
);

export { app, Framework7, $ };
