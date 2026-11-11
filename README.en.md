<div align="center">

<img src="public/logo.webp" width="96" height="96" alt="GanCook-10k" />

# 🍳 GanCook-10k

**A self-hosted family meal-ordering, grocery prep & kitchen chore system for your NAS.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-single--file-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

[中文](README.md) · English

</div>

---

**GanCook-10k** is a custom, self-maintained family kitchen web app built for local NAS deployment. Every piece of data (SQLite database and uploaded WebP photos) stays on your own NAS with zero cloud dependencies.

## ✨ Highlights

- 🍽️ **Dual Menus & Seasonal Posters** — Switch between the **Everyday Menu** (manual picks + dishes cooked 2+ times in the last 3 months) and the **Full Menu** (2-level category sidebar, search, and featured seasonal posters).
- 🌙 **5 Meal Slots & Late-Night Rollover** — Breakfast, Lunch, Snack, Dinner, and Late Night, with a `02:00 AM` day rollover so post-midnight snacks stay attached to tonight.
- 🥕 **Grocery & Prep Ledger** — Log bought ingredients, fridge items, prep notes, and receipt photos with automatic daily/weekly spend totals.
- 👨‍👩‍👧 **4-Role Kitchen Contributions** — Track Prep, Cooking (multi-cook supported), Ordering, and Cleanup on a filterable heatmap.
- ⭐ **Quick & 6-Axis Radar Ratings** — Rate meals in `0.5`-star steps or across 6 dimensions (Taste, Texture, Looks, Portion, Value, Experience).
- ⏰ **Auto-Scheduled Meals** — Recurring rules open ordering ahead of time, close at the deadline, and mark meals done automatically.
- 🥛 **Milk Fabric UI & Bilingual** — Mobile-first PWA with one-tap 中文 / English switching.

## 🚀 Quick Start (Docker Compose)

```bash
git clone https://github.com/TenTh0usand/GanCook.git
cd GanCook
docker compose up -d --build
```

Open `http://<your-nas>:3000` — the first account created becomes the family admin.

## 🛠️ Local Development

```bash
npm ci
cp .env.example .env.local
npm run db:migrate
npm run dev
```

## 💾 Backups

All state lives inside the `data/` directory (`app.db` + `uploads/`). Back up that folder to preserve everything.

## 📄 License

[MIT](LICENSE)
