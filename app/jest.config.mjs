// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

export default  {
  coverageProvider: "v8",
    moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.mjs$': '$1',
  },
  // JestでESModuleのテストを有効にするためのパラメータ
  preset: "ts-jest/presets/default-esm",
  roots: [
    "<rootDir>/src"
  ],
  moduleFileExtensions: ["mts", "ts", "tsx", "js", "mjs", "cjs"],
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/**/*.+(mts|ts|tsx|js|mjs)",
    "**/?(*.)+(spec|test).+(mts|ts|tsx|js|mjs)"
  ],
  transform: {
    "^.+\\.(mts|ts|tsx)$": [
      "ts-jest",
      // JestでESModuleのテストを有効にするためのパラメータ
      {
        "useESM": true
      }
    ]
  }
};
