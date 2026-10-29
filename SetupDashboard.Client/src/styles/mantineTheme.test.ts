import { describe, expect, it } from 'vitest'
import type { MantineThemeOther } from '@mantine/core'
import { createDfrntTheme, dfrntTheme } from './mantineTheme'
import { contrastRatio, getMd3Scheme } from './md3'

// createTheme() types `other` as optional; ours always sets it.
const other = (theme: { other?: unknown }) => theme.other as MantineThemeOther

// The DFRNT brand as the dfrnt-brand-theming skill defines it: cyan primary with Ink text on it,
// softly-rounded (not pill) controls, Plus Jakarta Sans - and the tenant's Branding layered on top.
describe('DFRNT theme', () => {
  it('uses DFRNT cyan and the Ink shell when the tenant has no Branding', () => {
    expect(dfrntTheme.primaryColor).toBe('brand')
    expect(dfrntTheme.colors?.brand?.[5]?.toLowerCase()).toBe('#3bc7f4')
    expect(other(dfrntTheme).shell.appBar.toLowerCase()).toBe('#0d0c2c')
    expect(other(dfrntTheme).shell.inkContent).toBe(false)
  })

  it('puts readable text on the primary in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const s = getMd3Scheme(mode)
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

describe('tenant Branding', () => {
  it('drives the brand ramp and the app bar from the tenant primary', () => {
    const theme = createDfrntTheme({ highContrast: false, primary: '#1b5e20' })
    expect(theme.colors?.brand?.[5]?.toLowerCase()).toBe('#1b5e20')
    expect(other(theme).shell.appBar).toBe('#1b5e20')
    expect(other(theme).shell.inkContent).toBe(false)
  })

  it('puts Ink content on a light tenant primary', () => {
    const theme = createDfrntTheme({ highContrast: false, primary: '#ffeb3b' })
    expect(other(theme).shell.inkContent).toBe(true)
    expect(other(theme).scrim.text).toBe('#0d0c2c')
  })

  it('replaces the secondary ramp with the tenant secondary', () => {
    const theme = createDfrntTheme({ highContrast: false, secondary: '#6a1b9a' })
    expect(theme.colors?.reflex?.[5]?.toLowerCase()).toBe('#6a1b9a')
  })
})
