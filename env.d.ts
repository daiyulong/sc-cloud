// 补充 Next.js 构建时注入的环境变量类型声明
declare namespace NodeJS {
  interface ProcessEnv {
    GIT_COMMIT_SHA?: string
  }
}
