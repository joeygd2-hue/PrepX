import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", ".next-*/**", "drizzle/**", "playwright-report/**", "test-results/**", "public/sw.js", "next-env.d.ts"] },
  {
    // Server Components render once per request, so reading the clock there is correct.
    files: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/app/api/**/*.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
];

export default config;
