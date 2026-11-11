/** 当前应用版本（构建时由 Dockerfile ARG APP_VERSION 注入；本地默认 0.5.0） */
export const APP_VERSION = process.env.APP_VERSION || '0.5.0'

/** 项目代码仓库地址（GanCook-10k 自维护定制版） */
export const REPO_URL = 'https://github.com/TenTh0usand/GanCook'
