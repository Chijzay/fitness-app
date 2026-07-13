# FitnessTracker

Persönliche Web-App zur Fitness- und Diätverfolgung, entwickelt mit Next.js. Konzipiert für langfristiges Gewichtsmanagement, Körperzusammensetzung und Trainingsfortschritt.

> **Privates Projekt** — entwickelt für den persönlichen Gebrauch, kein öffentliches Produkt.

---

## Zugang

Die App ist erreichbar unter: **https://deine-app.fly.dev**

### Als App auf dem Handy installieren

Die App kann wie eine native App auf dem Smartphone installiert werden (PWA):

- **Android (Chrome):** Menü oben rechts (drei Punkte) → *„Zum Startbildschirm hinzufügen"* → *„Installieren"*
- **iPhone (Safari):** Teilen-Symbol unten → *„Zum Home-Bildschirm"*

Nach der Installation erscheint die App als eigenes Icon auf dem Startbildschirm und startet ohne Browser-Leiste.

---

## Funktionen

### Dashboard
- Tägliche Statusleiste mit Ziel-Tracking (Kalorien, Protein, Schritte, Schlaf)
- Wochenzusammenfassung mit Durchschnittswerten für Kalorien, Schlaf und Gewichtstrend
- Bestleistungen (längste Streak, niedrigstes Gewicht, beste Woche)
- Tagesnotizen
- Streak-Anzeige mit Feuer-Indikator

### Tracking-Module
| Modul | Was erfasst wird |
|---|---|
| **Gewicht** | Tagesgewicht, Körperfett %, Muskelanteil %, Magermasse |
| **Kalorien** | Gegessen, verbrannt, Tagesbilanz, Makros (Protein/KH/Fett) |
| **Diätverlauf** | Diätphasen, Kaloriendefizit-Verlauf, geschätztes Zieldatum |
| **Training** | Trainingseinheiten, Übungsfortschritt, Volumen pro Muskelgruppe |
| **Cardio** | Einheiten, Dauer, Distanz, Pace, Art |
| **Schritte** | Tagesschritte, Wochendurchschnitte, Ziel-Tracking |
| **Schlaf** | Bettzeit, Schlafzeit, Tiefschlaf, Schlaf-Score (0–100) |
| **Körpermaße** | Körpermessungen (Brust, Taille, Hüfte, Arme, Oberschenkel etc.) |
| **Ziele** | Zielkonfiguration für Gewicht, Kalorien, Protein, Schritte, Schlaf |

### Auswertung & Charts
- Interaktive Diagramme (Linie, Balken, gestapelt) via Recharts
- Einstellbare Zeiträume (7d / 14d / 30d / 90d / 180d oder individuell)
- Lineare Regressionstrendlinie für Gewicht
- Wochendurchschnitte über Tagesdaten gelegt
- Körperzusammensetzung (Fettmasse, Magermasse, Muskelmasse)
- Schlaf-Chart mit Tiefschlaf / Leichtschlaf / Wachzeit im Bett als gestapelte Balken

### Guide
- Ausführlicher Fitness- und Ernährungsguide auf Deutsch
- Formeln als LaTeX gerendert via KaTeX (BMR, TDEE, BMI, LBM, Schlaf-Score etc.)
- Variablen-Legende zur Erklärung der mathematischen Notation
- Glossar mit Begriffen aus Energiestoffwechsel, Körperzusammensetzung, Training und Ernährung
- Markdown-Inhalt mit Inhaltsverzeichnis-Navigation

### Sonstiges
- CSV-Export für alle wichtigen Tracking-Module
- Jeden vergangenen Eintrag per Doppelklick in der Tabelle bearbeiten
- Responsives Design — funktioniert auf Handy und Desktop
- Durchgängiges Dark Theme

---

## Technischer Aufbau

| Bereich | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) |
| Sprache | TypeScript |
| Datenbank | PostgreSQL via Neon |
| ORM | Prisma |
| Authentifizierung | NextAuth.js v5 (Credentials) |
| Diagramme | Recharts |
| Formeldarstellung | KaTeX |
| Styling | Custom CSS + Tailwind CSS |
| Deployment | Fly.io |

---

## Datenmodell (Übersicht)

```
Benutzer
├── Profil            (Größe, Gewicht, Geschlecht, Geburtsdatum, Aktivitätslevel)
├── Diätphase         (benannte Phasen mit Start-/Enddatum und Zielen)
├── Tagesprotokoll    (Gewicht, kcal, Makros, Schritte, Schlaf, Körperfett, Notizen)
├── Ziel              (Typ, Zielwert, Deadline)
├── Körpermaße        (Brust, Taille, Hüfte, Arme, Oberschenkel, Wade, Hals)
├── Kardioeinheit     (Typ, Dauer, Distanz, Pace)
└── Trainingseinheit  (Übungen, Sätze, Wiederholungen, Gewicht, Notizen)
```

---

## Berechnete Kennzahlen

Alle Berechnungen erfolgen clientseitig in `lib/calculations.ts`:

| Kennzahl | Formel |
|---|---|
| Grundumsatz (BMR) | Mifflin-St-Jeor: `10m + 6,25h − 5a ± Konstante` |
| Gesamtverbrauch (TDEE) | `BMR × Aktivitätsfaktor` |
| Körperfett % | Deurenberg: `1,2 × BMI + 0,23a − 10,8G − 5,4` |
| Schlaf-Score | `(Schlafzeit / 480) × 60 + (Tiefschlaf / Bettzeit / 0,22) × 40` |
| Muskelmasse | `Magermasse × 0,60 (♂) / 0,55 (♀)` |

---

## Projektstruktur

```
fitness-app/
├── app/                  # Next.js App Router – Seiten und API-Routen
│   ├── api/              # REST-Endpunkte (Protokolle, Ziele, Profil …)
│   ├── globals.css       # Globale Styles und CSS-Variablen
│   ├── layout.tsx        # Root-Layout mit Auth-Provider
│   └── page.tsx          # App-Shell und State-Management
├── components/
│   ├── detail/           # Detailansichten mit Charts je Modul
│   ├── Dashboard.tsx     # Haupt-Dashboard
│   ├── QuickEntry.tsx    # Tages-Schnelleingabe
│   ├── GuideView.tsx     # Fitness-Guide mit LaTeX-Formeln
│   └── …
├── lib/
│   ├── calculations.ts   # BMR, TDEE, Schlaf-Score, Körperzusammensetzung
│   ├── chartHelpers.tsx  # Gemeinsame Chart-Komponenten und Hilfsfunktionen
│   └── prisma.ts         # Prisma-Client-Singleton
├── prisma/
│   └── schema.prisma     # Datenbankschema
└── public/
    └── abnehm-guide.md   # Guide-Inhalt als Markdown
```

---

## Lizenz

Privates Projekt — alle Rechte vorbehalten.
