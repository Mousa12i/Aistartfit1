import { describe, expect, it } from 'vitest';
import { renderRecoveryPdf } from './pdf';
import { sampleDoctor } from './sample';

const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

describe('recovery PDF', () => {
  const { state, full } = sampleDoctor();
  it('renders the personal report with numbered references and StartFit rules', () => {
    const out = text(renderRecoveryPdf({ kind: 'personal', state, muscles: full.muscleStates, painLogs: full.painLogs, personName: 'Sam', generatedAt: new Date('2026-10-14T09:00:00Z') }));
    expect(out.startsWith('%PDF')).toBe(true);
    expect(out).toContain('Recovery report');
    expect(out).toContain('StartFit rules \\(not study results\\)');
    expect(out).toContain('doi.org/10.1007/s40279-022-01706-y');
    expect(out).toContain('What works for you');
  });
  it('renders the clinician record with pain details and return-to-training sessions', () => {
    const out = text(renderRecoveryPdf({ kind: 'clinician', state, muscles: full.muscleStates, painLogs: full.painLogs, generatedAt: new Date('2026-10-14T09:00:00Z') }));
    expect(out).toContain('Recovery record for a clinician');
    expect(out).toContain('Pain reports \\(self-reported\\)');
    expect(out).toContain('Sessions, last 28 days');
    expect(out).toContain('Return to training: Left knee');
    expect(out).not.toContain('What works for you');
  });
});
