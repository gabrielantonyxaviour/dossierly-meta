import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**", "public/pdf.worker.min.mjs"] },
  { rules: { "no-console": "error" } },
  { files: ["scripts/**", "eval/**"], rules: { "no-console": "off" } },
];

export default config;
