import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", ".next-*/**", "drizzle/**", "playwright-report/**", "test-results/**", "public/sw.js", "next-env.d.ts"] },
  {
    // Server Components render once per request, so reading the clock there is correct.
    files: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/app/api/**/*.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
  {
    // An effect may only return a cleanup function. Expression bodies silently return values
    // (e.g. scrollIntoView() now returns a Promise), which React rejects at runtime.
    files: ["src/**/*.tsx", "src/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/] > ArrowFunctionExpression:first-child[body.type!='BlockStatement'][body.type!='ArrowFunctionExpression'][body.type!='FunctionExpression']",
          message: "Use a block body for effects: an effect may only return a cleanup function.",
        },
      ],
    },
  },
];

export default config;
