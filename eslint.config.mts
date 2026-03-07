import js from "@eslint/js";
import prettierConfig from "eslint-plugin-prettier/recommended";
import reactDom from "eslint-plugin-react-dom";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactX from "eslint-plugin-react-x";
import {defineConfig, globalIgnores} from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
    globalIgnores(["dist", "cdk.out"]),
    {
        files: ["**/*.{ts,tsx,mts}"],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommendedTypeChecked,
            {
                languageOptions: {
                    parserOptions: {
                        projectService: true,
                    },
                },
            },
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
            reactX.configs["recommended-typescript"],
            reactDom.configs.recommended,
            prettierConfig,
        ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
    },
    {
        files: ["**/*.{ts,tsx,mts}"],
        rules: {
            curly: ["error", "all"],
        },
    },
]);
