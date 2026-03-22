/** @type {import('@types/eslint').Linter.BaseConfig} */
module.exports = {
  root: true,
  extends: ["@remix-run/eslint-config"],
  ignorePatterns: ["build/", "node_modules/", ".cache/"],
  rules: {
    "no-console": "warn",
  },
};
