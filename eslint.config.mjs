import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "**/.next/**", // 嵌套构建产物（如 .claude/worktrees/*/.next）
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    ".claude/**", // 工具目录（skills / worktrees / plans），非项目源码
  ]),
  {
    rules: {
      // 强制跨字段日期按自然日比较，禁止 toISOString().split() 这类隐式 UTC 截断
      // 改用 @/lib/utils 的 toDateString() / todayString() / toDateOnly()
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='split'][callee.object.callee.property.name='toISOString']",
          message:
            "禁止 toISOString().split()，请用 @/lib/utils 的 toDateString() / todayString()",
        },
      ],
    },
  },
])

export default eslintConfig
