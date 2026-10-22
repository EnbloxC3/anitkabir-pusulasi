import path from "path";
import framework7 from "rollup-plugin-framework7";

const ROOT_DIR = import.meta.dirname;

const SRC_DIR = path.resolve(ROOT_DIR, "./src");
const PUBLIC_DIR = path.resolve(ROOT_DIR, "./public");
const BUILD_DIR = path.resolve(ROOT_DIR, "./www");
export default async () => {
  return {
    plugins: [framework7({ emitCss: false })],
    root: SRC_DIR,
    base: "",
    publicDir: PUBLIC_DIR,
    envDir: ROOT_DIR,
    build: {
      outDir: BUILD_DIR,
      assetsInlineLimit: 0,
      emptyOutDir: true,
      rollupOptions: {
        treeshake: false,
      },
      chunkSizeWarningLimit: 2000,
    },
    resolve: {
      alias: {
        "@": SRC_DIR,
        "&": PUBLIC_DIR,
        $: ROOT_DIR,
      },
    },
    server: {
      host: true,
    },
    esbuild: {
      jsxFactory: "$jsx",
      jsxFragment: '"Fragment"',
    },
  };
};
