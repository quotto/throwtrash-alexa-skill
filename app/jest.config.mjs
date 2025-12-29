// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

export default  {
  coverageProvider: "v8",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.mjs$": "$1",
  },
  roots: [
    "<rootDir>/src"
  ],
  moduleFileExtensions: ["mts", "ts", "tsx", "js", "mjs", "cjs"],
  extensionsToTreatAsEsm: [".ts", ".tsx", ".mts"],
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/**/*.+(mts|ts|tsx|js|mjs)",
    "**/?(*.)+(spec|test).+(mts|ts|tsx|js|mjs)"
  ],
  transformIgnorePatterns: [
    "/node_modules/(?!(trash-common)/)"
  ],
  transform: {
    "^.+\\.(m?ts|tsx|js|mjs)$": [
      "@swc/jest",
      {
        "jsc": {
          "parser": {
            "syntax": "typescript",
            "tsx": true,
            "importAssertions": true
          },
          "target": "es2021"
        },
        "module": {
          "type": "es6"
        }
      }
    ]
  }
};
