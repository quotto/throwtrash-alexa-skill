import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
    js.configs.recommended,
    {
        files: ["src/**/*.{js,mjs,cjs,ts,mts,tsx}"],
        languageOptions: {
            ecmaVersion: 2018,
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.es2021,
            },
        },
        rules: {
            "no-console": "off",
            "no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                },
            ],
        },
    },
    {
        files: ["src/**/*.{ts,mts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                sourceType: "module",
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                },
            ],
        },
    },
    {
        files: ["src/**/__tests__/**/*.{js,mjs,cjs,ts,mts,tsx}"],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
    },
];
