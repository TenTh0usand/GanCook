import { redirect } from 'next/navigation'

// GanCook-10k：「贡献墙」已并入「统计」页，旧链接自动跳转
export default function WallPage() {
  redirect('/stats')
}
