import { Logger } from "./logger";
const log = Logger.channel("main");
log.success("%cScripts Began!", null, ["color: limegreen;"]);
let pn = performance.now();
console.time("scriptPerformance");
import { app } from "./app";
import { Compass } from "./compass";
import strings from "./string";

const TARGET = { lat: 39.925294, lon: 32.837438 }; // Anıtkabir's location
const FOV_H = 60;

let state = {
  lat: null,
  lon: null,
  azimuth: 0,
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

function waitForDomReady(callback, interval = 50, maxTry = 200) {
  const $$ = app.$;
  let count = 0;

  const timer = setInterval(() => {
    const needle = $$("#needleWrapper");

    if (needle && needle.length > 0) {
      clearInterval(timer);

      const el = {
        needle,
        card: $$("#compassCard"),
        azText: $$("#azimuthDisplay"),
        distBadge: $$("#distBadge"),
        arDistLabel: $$("#arDistLabel"),
        cameraView: $$("#cameraView"),
        video: $$("#camVideo"),
        tapeMarker: $$("#tapeMarker"),
        arrowLeft: $$("#arrowLeft"),
        arrowRight: $$("#arrowRight"),
        sirenBtn: $$("#sirenBtn"),
        sirenAudio: $$("#sirenAudio"),
        permBtn: $$("#permBtn"),
        refBtn: $$("#refBtn"),
        fabControlButtons: $$("#openControls, #openCompass"),
      };

      callback(el);
    }

    if (count++ > maxTry) {
      clearInterval(timer);
      log.warn("Timeout: DOM still not ready.");
    }
  }, interval);
}

log.info("Waiting for DOM Ready");
waitForDomReady((e) => {
  const compass = new Compass(e, app, TARGET, { FOV_H, state });
  compass.init();
  let npn = performance.now() - pn;
  log.debug("Compass Inited");
  log.debug(`in %c${npn.toFixed(1)}ms`, log.addChannel("performance"), [
    "color: blue;",
  ]);
  console.timeEnd("scriptPerformance");
  console.log(
    `%c${app.name.toLocaleUpperCase(strings.internal.lang)}%c\n%c${
      strings.app.description
    } %cv${strings.internal.version}`,
    `
    background: linear-gradient(135deg, #e30a17, #ff5a5f, #8b0000);
    color: white;
    border: 1px solid #e30a17;
    padding: 5px 10px;
    font-size: 23px;
    font-weight: 700;
    line-height: 1.5;
    `,
    `all: initial;`,
    `color: initial;
    border: 1px solid #e30a17;`,
    `color: #e30a17;
    border: 1px solid #e30a17;`,
  );
});

setTimeout(() => {
  log.warn(
    "%c⚠️ WARNING %cThe browser console (this tool) may expose sensitive information, including your precise location, device details, personal data, and other confidential information.%c\n%cDO NOT: %cShare these logs without checking them, screen sharing here, send screenshot of here.",
    null,
    [
      `color: blueviolet;
    border: 1px solid blueviolet;
    font-size: 18px;
    line-height: 1.5;
    font-weight: 700;`,
      `color: initial;
    font-size: 14px;
    border: 1px solid blueviolet;`,
      `all: initial;`,
      `color: red;
      font-size: 17px;
      font-weight: 400;
      line-height: 1.5;`,
      `color: initial;
      border: 1px solid red;`,
    ],
  );
}, 1550);
