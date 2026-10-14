import { describe, expect, it } from 'vitest';
import { getBundledRecoveryData, loadRecoveryData } from './loader';

describe('recovery data loader', () => {
  it('loads the catalog with known asset regions', () => { expect(getBundledRecoveryData().muscles).toHaveLength(19); });
  it('rejects unknown anatomy regions', () => { expect(() => loadRecoveryData(['732c41cd-a29f-4a6a-8bb5-4d68133ef241'], ['not-a-region'])).toThrow('Unknown anatomy asset region'); });
});
