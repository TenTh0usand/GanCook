import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 单容器自部署：输出独立运行包，Docker 只需拷贝 standalone
  output: 'standalone',
  // better-sqlite3 / sharp 是原生模块，标记为外部依赖避免被打包
  serverExternalPackages: ['better-sqlite3', 'node-cron', 'sharp'],
  experimental: {
    // 菜品/头像图片通过 Server Action 上传，放宽请求体上限
    serverActions: { bodySizeLimit: '12mb' },
    // 数据导入（/api/admin/import）会经过 proxy，默认 10MB 会截断请求体
    proxyClientMaxBodySize: '100mb',
  },
}

export default nextConfig
