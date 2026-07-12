function calcAge(birthdate: Date): number {
  const b = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const monthDiff = now.getMonth() - b.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function calcBMR(
  weightKg: number,
  heightCm: number,
  gender: string,
  birthdate: Date
): number {
  const age = calcAge(birthdate);
  if (gender === "male") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

export function calcTDEE(bmr: number, activityLevel: number): number {
  return bmr * activityLevel;
}

// Schätzung Muskelanteil in % aus Körpergewicht und Körperfett (Skelettmuskel ≈ 60% LBM)
export function estimateMuscleMass(weightKg: number, bodyFatPercent: number, gender: string): number {
  const lbmPct = 1 - bodyFatPercent / 100;
  const factor = gender === "male" ? 0.60 : 0.55;
  return Math.round(lbmPct * factor * 100 * 10) / 10; // gibt % zurück
}

// Schätzung Körperfett% aus BMI (Deurenberg-Formel)
export function estimateBodyFat(
  weightKg: number,
  heightCm: number,
  gender: string,
  birthdate: Date
): number {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const age = calcAge(birthdate);
  const sexFactor = gender === "male" ? 1 : 0;
  return 1.2 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4;
}

// Max empfohlenes kcal-Defizit: Körperfett (kg) × 70
export function calcMaxDeficit(weightKg: number, bodyFatPercent: number): number {
  const fatKg = weightKg * (bodyFatPercent / 100);
  return Math.round(fatKg * 70);
}

export function calcSleepScore(
  sleepActual: number | null,
  sleepDeep: number | null,
  sleepTotal: number | null
): number | null {
  if (!sleepActual) return null;
  const durationScore = Math.min(sleepActual / 480, 1); // 8h = 100%
  if (!sleepDeep || !sleepTotal) return Math.round(durationScore * 100);
  const deepRatio = sleepDeep / sleepTotal;
  const deepScore = Math.min(deepRatio / 0.22, 1); // 22% Tiefschlaf = 100%
  return Math.round(durationScore * 0.6 * 100 + deepScore * 0.4 * 100);
}

export function calcFatKgFromKcal(kcal: number): number {
  return kcal / 7700;
}

export function calcProgressPercent(
  startWeight: number,
  currentWeight: number,
  goalWeight: number
): number {
  const total = startWeight - goalWeight;
  if (total === 0) return 100;
  const done = startWeight - currentWeight;
  return Math.round((done / total) * 100);
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: "Sitzend (kaum Bewegung)" },
  { value: 1.375, label: "Leicht aktiv (1–3×/Woche Sport)" },
  { value: 1.55, label: "Moderat aktiv (3–5×/Woche Sport)" },
  { value: 1.725, label: "Sehr aktiv (6–7×/Woche Sport)" },
  { value: 1.9, label: "Extrem aktiv (körperliche Arbeit + Sport)" },
];

// Schritt-basierte Aktivitäten (Schritte werden gezählt)
export const STEPS_TYPES = [
  "Keine Aktivität",
  "Spazieren",
  "Incline Walk",
  "Joggen",
  "Wandern",
  "Eigene Eingabe",
];

// Bewegungsaktivitäten ohne Schritte (Dauer relevant, keine Schritte)
export const MOVEMENT_TYPES = [
  "Schwimmen",
  "Radfahren",
  "Krafttraining",
  "Yoga / Dehnen",
  "HIIT",
  "Eigene Eingabe",
];

export function isStepBased(type: string) {
  return STEPS_TYPES.includes(type) || (!MOVEMENT_TYPES.slice(0, -1).includes(type));
}

// Wasserempfehlung in ml: 35ml/kg Körpergewicht, Mindest 1500ml
export function calcWaterRecommendation(weightKg: number): number {
  return Math.max(1500, Math.round(weightKg * 35 / 100) * 100);
}
