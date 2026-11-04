import { createRequire } from "node:module";
import { resolve } from "node:path";

// Optional external dependency location for restricted build environments.
// Normal npm installs use this project's own package.json.
const require = createRequire(
  resolve(process.env.DESK_DEPENDENCY_ROOT || ".", "package.json"),
);
export default {
  base: "./",
  resolve: {
    alias: [
      {
        find: /^react-dom\/client$/,
        replacement: require.resolve("react-dom/client"),
      },
      { find: /^react-dom$/, replacement: require.resolve("react-dom") },
      {
        find: /^react\/jsx-runtime$/,
        replacement: require.resolve("react/jsx-runtime"),
      },
      { find: /^react$/, replacement: require.resolve("react") },
    ],
  },
  build: { target: "es2022", sourcemap: false },
};
