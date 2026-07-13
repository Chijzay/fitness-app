# 💪 FitnessTracker

A personal fitness and diet tracking web app built with Next.js, designed for long-term weight management, body composition tracking, and training progress monitoring.

> **Private project** — built for personal use, not intended as a public SaaS product.

---

## Features

### Dashboard
- Daily status bar with goal tracking (calories, protein, steps, sleep)
- Weekly summary with average calories, sleep, and weight trend
- Personal best records (longest streak, lowest weight, best week)
- Daily notes
- Streak tracking with fire indicator

### Tracking Modules
| Module | What it tracks |
|---|---|
| **Gewicht** | Daily weight, body fat %, muscle mass %, lean body mass |
| **Kalorien** | Consumed, burned, daily balance, macro split (protein/carbs/fat) |
| **Diätverlauf** | Diet phases, calorie deficit trend, projected goal date |
| **Training** | Workout sessions, exercise progression, volume per muscle group |
| **Cardio** | Sessions, duration, distance, pace, type |
| **Schritte** | Daily steps, weekly averages, goal tracking |
| **Schlaf** | Time in bed, actual sleep, deep sleep, sleep score (0–100) |
| **Körpermaße** | Body measurements (chest, waist, hips, arms, thighs, etc.) |
| **Ziele** | Goal configuration for weight, calories, protein, steps, sleep |

### Analytics & Charts
- Interactive charts via Recharts (line, bar, composed, stacked)
- Adjustable date ranges (7d / 14d / 30d / 90d / 180d or custom)
- Linear regression trend lines for weight
- Weekly averages overlaid on daily data
- Body composition breakdown (fat mass, lean mass, muscle mass)
- Sleep chart showing deep sleep / light sleep / time awake in bed as stacked bars

### Guide
- Comprehensive German-language fitness and nutrition guide
- Formulas rendered in LaTeX via KaTeX (BMR, TDEE, BMI, LBM, sleep score, etc.)
- Variables legend explaining all mathematical notation
- Glossary with terms from energy metabolism, body composition, training, nutrition
- Markdown-rendered content with table of contents navigation

### Other
- CSV export for all major tracking modules
- Edit any past entry via double-click in data tables
- Responsive design — works on mobile and desktop
- Dark theme throughout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Neon |
| ORM | Prisma |
| Auth | NextAuth.js v5 (credentials) |
| Charts | Recharts |
| Math rendering | KaTeX |
| Styling | Custom CSS + Tailwind CSS |
| Deployment | Fly.io |

---

## Data Model (Overview)

```
User
├── Profile          (height, weight, gender, birthdate, activity level)
├── DietPhase        (named phases with start/end dates and goals)
├── DailyLog         (weight, kcal, macros, steps, sleep, body fat, notes)
├── Goal             (type, target value, deadline)
├── BodyMeasurement  (chest, waist, hips, arms, thighs, calves, neck)
├── CardioSession    (type, duration, distance, pace)
└── WorkoutSession   (exercises, sets, reps, weight, notes)
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database (e.g. Neon free tier)

### Installation

```bash
git clone https://github.com/Chijzay/fitness-app.git
cd fitness-app
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

### Database Setup

```bash
npx prisma migrate deploy
npx prisma generate
```

### Development

```bash
npm run dev
```

Open http://localhost:3000.

### Production Build

```bash
npm run build
npm start
```

---

## Calculated Metrics

All calculations happen client-side in `lib/calculations.ts`:

| Metric | Formula |
|---|---|
| BMR | Mifflin-St-Jeor: `10m + 6.25h − 5a ± const` |
| TDEE | `BMR × activity factor` |
| Body fat % | Deurenberg: `1.2 × BMI + 0.23a − 10.8G − 5.4` |
| Sleep score | `(sleep / 480) × 60 + (deep / bed / 0.22) × 40` |
| Muscle mass | `LBM × 0.60 (♂) / 0.55 (♀)` |

---

## Project Structure

```
fitness-app/
├── app/                  # Next.js App Router pages and API routes
│   ├── api/              # REST API endpoints (logs, goals, profile, …)
│   ├── globals.css       # Global styles and CSS variables
│   ├── layout.tsx        # Root layout with auth provider
│   └── page.tsx          # Main app shell and state management
├── components/
│   ├── detail/           # Per-module detail views with charts
│   ├── Dashboard.tsx     # Main dashboard
│   ├── QuickEntry.tsx    # Daily quick-entry form
│   ├── GuideView.tsx     # Fitness guide with LaTeX formulas
│   └── …
├── lib/
│   ├── calculations.ts   # BMR, TDEE, sleep score, body composition
│   ├── chartHelpers.tsx  # Shared chart components and utilities
│   └── prisma.ts         # Prisma client singleton
├── prisma/
│   └── schema.prisma     # Database schema
└── public/
    └── abnehm-guide.md   # Guide content in Markdown
```

---

## License

Private project — all rights reserved.
