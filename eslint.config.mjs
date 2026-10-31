import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['app/portal/**/*.{ts,tsx}', 'app/admin/page.tsx', 'components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
    rules: {
      // Student/admin browser bundles may use shared shapes, never the DB or grading implementation.
      'no-restricted-imports': ['error', { paths: ['@/lib/exams', '@/lib/db', '@/lib/lms'].map((name) => ({ name, allowTypeImports: true, message: 'Server data/grading modules must not be imported into browser code. Use API calls and import type only.' })) }],
    },
  },
  {
    files: ['app/portal/exams/**/*.{ts,tsx}', 'components/exams/**/*.{ts,tsx}', 'components/admin/ExamResults.tsx', 'hooks/useExams.ts'],
    rules: { 'no-console': 'error' },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
