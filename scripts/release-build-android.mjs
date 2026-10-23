// directly using gradlew and apksigner sh/bat and jar files cuz capacitor is ass

import "dotenv/config";
import fs from "node:fs";
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
    case "--signing":
      signing = val;
      break;
  }
}

const userArgs = process.argv.slice(2);
const validArgs = ["--out", "-o", "--signing"];
let output = "apk";
let signing = "jarsigner";

for (let i = 0; i < userArgs.length; i++) {
  const arg = userArgs[i];
  if (!validArgs.includes(arg)) {
    console.error(`Unknown arg: ${arg}`);
    process.exit(1);
  }

  const value = userArgs[++i];
  if (!value || value.startsWith("-")) {
    console.error(`Missing value for ${arg}`);
    process.exit(1);
  }
  useArg(arg, value.toLowerCase());
}

const releaseTypes = {
  apk: "APK",
  aab: "AAB",
};

const signingTypes = {
  jarsigner: "jarsigner",
  apksigner: "apksigner",
};

const releaseType = releaseTypes[output];
const signingType = signingTypes[signing];

if (!releaseType) {
  console.error("Out type invalid. Usage: --out [aab/apk]");
  process.exit(1);
}

if (!signingType) {
  console.error("Signing type invalid. Usage: --signing [jarsigner/apksigner]");
  process.exit(1);
}

if (signingType === "apksigner" && releaseType !== "APK") {
  console.error("apksigner can only be used with APK output.");
  process.exit(1);
}

const capacitorCli = path.resolve("node_modules/@capacitor/cli/bin/capacitor");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (signingType === "apksigner") {
  const androidDir = path.resolve("android");
  const androidSdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (!androidSdk) {
    console.error(
      "Set ANDROID_SDK_ROOT or ANDROID_HOME to the Android SDK directory.",
    );
    process.exit(1);
  }

  const buildToolsDir = path.join(androidSdk, "build-tools");
  let buildToolsVersions;
  try {
    buildToolsVersions = fs.readdirSync(buildToolsDir);
  } catch (error) {
    console.error(
      `Could not read Android build-tools directory: ${buildToolsDir}`,
    );
    console.error(error.message);
    process.exit(1);
  }

  const apksignerJar = buildToolsVersions
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    .map((version) => {
      const versionDir = path.join(buildToolsDir, version);
      const candidates = [
        path.join(versionDir, "lib", "apksigner.jar"),
        path.join(versionDir, "apksigner.jar"),
      ];
      return candidates.find((candidate) => fs.existsSync(candidate));
    })
    .find(Boolean);

  if (!apksignerJar) {
    console.error(`Could not find apksigner.jar in ${buildToolsDir}`);
    process.exit(1);
  }

  const java = process.env.JAVA_HOME
    ? path.join(
        process.env.JAVA_HOME,
        "bin",
        process.platform === "win32" ? "java.exe" : "java",
      )
    : "java";
  const gradleArgs = ["assembleRelease"];

  console.log("Building unsigned release APK...");
  const gradleWrapperJar = path.join(
    androidDir,
    "gradle",
    "wrapper",
    "gradle-wrapper.jar",
  );
  if (!fs.existsSync(gradleWrapperJar)) {
    console.error(`Could not find Gradle wrapper JAR: ${gradleWrapperJar}`);
    process.exit(1);
  }
  run(
    java,
    [
      "-classpath",
      gradleWrapperJar,
      "org.gradle.wrapper.GradleWrapperMain",
      ...gradleArgs,
    ],
    {
      cwd: androidDir,
    },
  );

  const apkDir = path.join(
    androidDir,
    "app",
    "build",
    "outputs",
    "apk",
    "release",
  );
  const unsignedApk = path.join(apkDir, "app-release-unsigned.apk");
  const signedApk = path.join(apkDir, "app-release-signed.apk");
  const signingArgs = [
    "-jar",
    apksignerJar,
    "sign",
    "--ks",
    path.resolve(process.env.ANDROID_KEYSTORE_PATH),
    "--ks-pass",
    `pass:${process.env.ANDROID_KEYSTORE_PASSWORD}`,
    "--ks-key-alias",
    process.env.ANDROID_KEY_ALIAS,
    "--key-pass",
    `pass:${process.env.ANDROID_KEY_PASSWORD}`,
    "--in",
    unsignedApk,
    "--out",
    signedApk,
  ];

  console.log("Signing release APK...");
  run(java, signingArgs);
  console.log(`Successfully generated app-release-signed.apk at: ${apkDir}`);
} else {
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
    "--signing-type",
    signingType,
  ];

  run(process.execPath, args, { shell: false });
}
