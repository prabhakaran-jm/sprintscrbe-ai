module.exports = {
    root: true,
    env: {
      es2022: true,
      node: true,
      browser: true,
    },
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      ecmaFeatures: {
        jsx: true,
      },
    },
    ignorePatterns: [
      "node_modules/",
      "dist/",
      "build/",
      ".forge/",
    ],
};
  