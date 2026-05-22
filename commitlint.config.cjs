/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["result", "codemod", "eslint-plugin", "repo", "deps", "ci", "docs"],
    ],
    "scope-empty": [2, "never"],
    "body-max-line-length": [0, "always"],
    "footer-max-line-length": [0, "always"],
  },
};
