/** 存储配置类型（客户端也能用；服务端实现见 lib/storage.ts） */
export type StorageProvider = 'r2' | 's3'
export type S3Config = {
  provider: StorageProvider
  accountId: string
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  publicBase: string
  prefix: string
}
