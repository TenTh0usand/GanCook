/**
 * 撒钱特效（GanCook-10k · P5）
 * - spend：切到「出去吃」——从图标中心像烟花一样炸开约 30 张钱，飞满屏幕，带重力下落，约 1.5 秒
 * - save ：切回「在家」——约 10 枚金币从四周飞回图标，冒出「省钱了」小字，约 0.8 秒
 * 纯 Web Animations：只动 transform / opacity（GPU 合成），挂在页面最上层且不挡点击，播完自动移除。
 * 系统开了「减弱动态效果」时不播放。
 */
const SPEND = ['💸', '💵', '💰', '🪙', '💸', '💵']

function layer(): HTMLDivElement {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:70;overflow:hidden;contain:strict'
  document.body.appendChild(el)
  return el
}

function particle(host: HTMLElement, x: number, y: number, text: string, size: number): HTMLSpanElement {
  const s = document.createElement('span')
  s.textContent = text
  s.style.cssText = `position:absolute;left:${x}px;top:${y}px;font-size:${size}px;line-height:1;margin:-0.5em 0 0 -0.5em;will-change:transform,opacity;user-select:none`
  host.appendChild(s)
  return s
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

export function moneyBurst(origin: { x: number; y: number }, mode: 'spend' | 'save', savedText = '') {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const host = layer()
  const anims: Animation[] = []
  const { x, y } = origin
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (mode === 'spend') {
    const reach = Math.max(vw, vh) * 0.62
    for (let i = 0; i < 30; i++) {
      const el = particle(host, x, y, SPEND[i % SPEND.length], rand(22, 36))
      // 360° 炸开（略偏上），再靠重力往下落，铺满整个屏幕
      const ang = Math.random() < 0.65 ? rand(-Math.PI, 0) : rand(0, Math.PI)
      const dist = rand(0.35, 1) * reach
      const dx = Math.cos(ang) * dist
      const dy = Math.sin(ang) * dist
      const fall = rand(0.45, 0.8) * vh
      const rot = rand(-540, 540)
      const dur = rand(1250, 1600)
      anims.push(
        el.animate(
          [
            { transform: 'translate(0,0) scale(0.3) rotate(0deg)', opacity: 0 },
            { transform: `translate(${dx * 0.55}px,${dy * 0.55}px) scale(1.1) rotate(${rot * 0.3}deg)`, opacity: 1, offset: 0.18 },
            { transform: `translate(${dx}px,${dy}px) scale(1) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.42 },
            { transform: `translate(${dx * 1.15}px,${dy + fall}px) scale(0.9) rotate(${rot}deg)`, opacity: 0 },
          ],
          { duration: dur, delay: rand(0, 120), easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'forwards' },
        ),
      )
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + rand(-0.3, 0.3)
      const r = rand(110, 170)
      const sx = Math.cos(ang) * r
      const sy = Math.sin(ang) * r
      const el = particle(host, x, y, '🪙', rand(18, 26))
      anims.push(
        el.animate(
          [
            { transform: `translate(${sx}px,${sy}px) scale(1) rotate(${rand(-120, 120)}deg)`, opacity: 0 },
            { transform: `translate(${sx * 0.8}px,${sy * 0.8}px) scale(1)`, opacity: 1, offset: 0.25 },
            { transform: 'translate(0,0) scale(0.35) rotate(0deg)', opacity: 0.2 },
          ],
          { duration: rand(520, 680), delay: i * 22, easing: 'cubic-bezier(0.55, 0, 0.75, 0.4)', fill: 'forwards' },
        ),
      )
    }
    if (savedText) {
      const tip = particle(host, x, y, savedText, 14)
      tip.style.cssText +=
        ';margin:0;white-space:nowrap;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--mf-surface);color:var(--mf-ink);box-shadow:var(--mf-elev-2);translate:-50% -140%'
      anims.push(
        tip.animate(
          [
            { transform: 'translateY(6px) scale(0.9)', opacity: 0 },
            { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.25 },
            { transform: 'translateY(-4px) scale(1)', opacity: 1, offset: 0.75 },
            { transform: 'translateY(-14px) scale(0.98)', opacity: 0 },
          ],
          { duration: 1100, delay: 380, easing: 'ease-out', fill: 'forwards' },
        ),
      )
    }
  }

  Promise.allSettled(anims.map((a) => a.finished)).then(() => host.remove())
  setTimeout(() => host.remove(), 2500) // 兜底
}
