import type { Profile } from './types';

export interface RoutineData {
  routine_name: string;
  summary: string;
  physiological_reasoning?: string;
  macros?: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  days: {
    day: string;
    focus: string;
    exercises: { name: string; sets: number; reps: string; rest: string; notes: string; form_cues?: string }[];
  }[];
  progression_notes: string;
}

export function downloadRoutinePDF(routine: RoutineData, profile: Profile | null): void {
  const w = window.open('', '_blank');
  if (!w) return;

  const html = buildBlueprintHTML(routine, profile);
  w.document.write(html);
  w.document.close();

  setTimeout(() => {
    w.print();
  }, 500);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildBlueprintHTML(routine: RoutineData, profile: Profile | null): string {
  const bio = profile
    ? `
      <div class="bio-grid">
        <div class="bio-item"><span class="bio-label">Weight</span><span class="bio-val">${profile.weight_kg ?? '—'} kg</span></div>
        <div class="bio-item"><span class="bio-label">Height</span><span class="bio-val">${profile.height_cm ?? '—'} cm</span></div>
        <div class="bio-item"><span class="bio-label">Body Fat</span><span class="bio-val">${profile.body_fat_pct ?? '—'}%</span></div>
        <div class="bio-item"><span class="bio-label">Goal</span><span class="bio-val">${esc(profile.physique_goal ?? profile.fitness_goal ?? '—')}</span></div>
        <div class="bio-item"><span class="bio-label">Experience</span><span class="bio-val">${esc(profile.experience_level ?? '—')}</span></div>
        <div class="bio-item"><span class="bio-label">Limitations</span><span class="bio-val">${esc(profile.limitations ?? 'None')}</span></div>
      </div>`
    : '';

  const macros = routine.macros
    ? `
      <div class="macro-grid">
        <div class="macro-item"><span class="macro-val">${routine.macros.calories}</span><span class="macro-label">kcal/day</span></div>
        <div class="macro-item"><span class="macro-val">${routine.macros.protein_g}g</span><span class="macro-label">Protein</span></div>
        <div class="macro-item"><span class="macro-val">${routine.macros.carbs_g}g</span><span class="macro-label">Carbs</span></div>
        <div class="macro-item"><span class="macro-val">${routine.macros.fat_g}g</span><span class="macro-label">Fat</span></div>
      </div>`
    : '';

  const reasoning = routine.physiological_reasoning
    ? `<div class="reasoning-box"><h3>Physiological Reasoning</h3><p>${esc(routine.physiological_reasoning)}</p></div>`
    : '';

  const days = routine.days
    .map(
      (d) => `
      <div class="day-card">
        <div class="day-header">
          <span class="day-name">${esc(d.day)}</span>
          <span class="day-focus">${esc(d.focus)}</span>
        </div>
        <table class="exercise-table">
          <thead>
            <tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th><th>Notes</th></tr>
          </thead>
          <tbody>
            ${d.exercises
              .map(
                (ex) => `
              <tr>
                <td class="ex-name">${esc(ex.name)}${ex.form_cues ? `<span class="form-cue">${esc(ex.form_cues)}</span>` : ''}</td>
                <td class="center">${ex.sets}</td>
                <td class="center">${esc(ex.reps)}</td>
                <td class="center">${esc(ex.rest)}</td>
                <td class="ex-notes">${esc(ex.notes)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(routine.routine_name)} — StartFit Blueprint</title>
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: #0A0E0C;
    color: #F0F4F1;
    padding: 32px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 2px solid #A6FF32; padding-bottom: 16px; margin-bottom: 24px;
  }
  .logo {
    font-size: 24px; font-weight: 800; letter-spacing: -0.5px;
    background: linear-gradient(135deg, #A6FF32, #7FE618);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .badge {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
    color: #A6FF32; border: 1px solid rgba(166,255,50,0.3);
    padding: 4px 12px; border-radius: 20px;
  }
  h1 {
    font-size: 28px; font-weight: 800; margin-bottom: 8px; color: #F0F4F1;
  }
  .subtitle { font-size: 13px; color: #8B9A93; margin-bottom: 20px; line-height: 1.5; }
  h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #A6FF32; margin-bottom: 10px; }

  .bio-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;
  }
  .bio-item {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px; padding: 10px 14px;
  }
  .bio-label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #8B9A93; margin-bottom: 3px; }
  .bio-val { display: block; font-size: 14px; font-weight: 600; color: #F0F4F1; }

  .reasoning-box {
    background: rgba(166,255,50,0.04); border: 1px solid rgba(166,255,50,0.12);
    border-radius: 12px; padding: 16px 18px; margin-bottom: 20px;
  }
  .reasoning-box p { font-size: 12px; color: #B5C4BD; line-height: 1.6; }

  .macro-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px;
  }
  .macro-item {
    background: rgba(166,255,50,0.06); border: 1px solid rgba(166,255,50,0.15);
    border-radius: 10px; padding: 12px; text-align: center;
  }
  .macro-val { display: block; font-size: 20px; font-weight: 800; color: #A6FF32; }
  .macro-label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #8B9A93; margin-top: 2px; }

  .day-card {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px; margin-bottom: 16px; overflow: hidden;
  }
  .day-header {
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(166,255,50,0.08); padding: 10px 16px;
    border-bottom: 1px solid rgba(166,255,50,0.15);
  }
  .day-name { font-size: 14px; font-weight: 700; color: #A6FF32; }
  .day-focus { font-size: 11px; color: #8B9A93; }

  .exercise-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .exercise-table th {
    text-align: left; padding: 8px 12px; font-size: 9px; text-transform: uppercase;
    letter-spacing: 1px; color: #8B9A93; border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .exercise-table td {
    padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.03);
    color: #B5C4BD; vertical-align: top;
  }
  .ex-name { font-weight: 600; color: #F0F4F1; }
  .form-cue { display: block; font-size: 9px; color: #8B9A93; font-style: italic; margin-top: 2px; }
  .center { text-align: center; }
  .ex-notes { font-size: 10px; color: #8B9A93; }

  .progression {
    background: rgba(166,255,50,0.05); border: 1px solid rgba(166,255,50,0.12);
    border-radius: 12px; padding: 16px 18px; margin-top: 24px;
  }
  .progression p { font-size: 12px; color: #B5C4BD; line-height: 1.6; }

  .footer {
    margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06);
    text-align: center; font-size: 10px; color: #5A6B64;
  }
  @media print {
    body { padding: 0; }
    .day-card { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <span class="logo">StartFit</span>
    <span class="badge">AI Blueprint · o3-mini</span>
  </div>

  <h1>${esc(routine.routine_name)}</h1>
  <p class="subtitle">${esc(routine.summary)}</p>

  ${bio}

  ${reasoning}

  ${macros}

  <h3>Weekly Program</h3>
  ${days}

  <div class="progression">
    <h3>Progression Strategy</h3>
    <p>${esc(routine.progression_notes)}</p>
  </div>

  <div class="footer">
    Generated by StartFit AI · Powered by o3-mini reasoning engine · ${new Date().toLocaleDateString('en-GB')}
  </div>
</body>
</html>`;
}
