import { val } from "dom7";
import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";

const required = [
  "ANDROID_KEYSTORE_PATH",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing .env variable: ${key}`);
    process.exit(1);
  }
}

function useArg(arg, val) {
  switch (arg) {
    case "--out":
      output = val;
      break;
    case "-o":
      output = val;
      break;
  }
}

const userArgs = process.argv.slice(2);
const validArgs = ["--out", "-o"];
let output = "apk";

for (let i = 0; i < userArgs.length; i++) {
  const arg = userArgs[i];
  const argval = userArgs[++i]?.toLowerCase();
  if (validArgs.includes(arg)) {
    useArg(arg, argval);
  } else {
    console.error(`Unknown arg: ${userArgs[i]}`);
    process.exit(1);
  }
}

const releaseTypes = {
  apk: "APK",
  aab: "AAB",
};

const releaseType = releaseTypes[output];

if (!releaseType) {
  console.error("Out type invalid. Usage: --out apk or --out aab");
  process.exit(1);
}

const capacitorCli = path.resolve("node_modules/@capacitor/cli/bin/capacitor");

const args = [
  capacitorCli,
  "build",
  "android",
  "--androidreleasetype",
  releaseType,
  "--keystorepath",
  path.resolve(process.env.ANDROID_KEYSTORE_PATH),
  "--keystorepass",
  process.env.ANDROID_KEYSTORE_PASSWORD,
  "--keystorealias",
  process.env.ANDROID_KEY_ALIAS,
  "--keystorealiaspass",
  process.env.ANDROID_KEY_PASSWORD,
];

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
