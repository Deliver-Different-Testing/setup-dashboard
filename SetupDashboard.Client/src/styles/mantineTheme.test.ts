import { describe, expect, it } from 'vitest'
import { dfrntTheme } from './mantineTheme'
import { contrastRatio, getMd3Scheme } from './md3'

// The DFRNT brand as the dfrnt-brand-theming skill defines it: cyan primary with Ink text on it,
// softly-rounded (not pill) controls, Plus Jakarta Sans.
describe('DFRNT theme', () => {
  it('uses DFRNT cyan as the primary for every tenant', () => {
    expect(dfrntTheme.primaryColor).toBe('brand')
    expect(dfrntTheme.colors?.brand?.[5]?.toLowerCase()).toBe('#3bc7f4')
  })

  it('puts readable text on the primary in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const s = getMd3Scheme('dfrnt', mode)
      expect(contrastRatio(s.onPrimary, s.primary)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps buttons softly rounded, not pills', () => {
    expect(dfrntTheme.defaultRadius).toBe('sm')
    expect(dfrntTheme.components?.Button?.defaultProps?.radius).toBe('sm')
  })

  it('sets Plus Jakarta Sans', () => {
    expect(dfrntTheme.fontFamily).toMatch(/Plus Jakarta Sans/)
  })
})
