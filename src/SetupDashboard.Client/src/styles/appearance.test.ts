import { describe, expect, it } from 'vitest'
import { parseAppearanceSettings, toThemeAppearance } from './appearance'

describe('parseAppearanceSettings', () => {
  it('keeps valid fields and lower-cases colours', () => {
    expect(parseAppearanceSettings({ contrast: 'high', primary: '#1B5E20', textDark: '#eeeeee' }))
      .toEqual({ contrast: 'high', primary: '#1b5e20', textDark: '#eeeeee' })
  })

  it('drops invalid fields and treats an all-invalid blob as no Branding', () => {
    expect(parseAppearanceSettings({ contrast: 'loud', primary: 'red', secondary: '#12345' })).toBeNull()
  })

  it('treats null, empty and malformed JSON as no Branding', () => {
    expect(parseAppearanceSettings(null)).toBeNull()
    expect(parseAppearanceSettings('')).toBeNull()
    expect(parseAppearanceSettings('{not json')).toBeNull()
  })
})

describe('toThemeAppearance', () => {
  it('follows the OS contrast preference when contrast is auto or unset', () => {
    expect(toThemeAppearance({ contrast: 'auto' }, true).highContrast).toBe(true)
    expect(toThemeAppearance(null, true).highContrast).toBe(true)
    expect(toThemeAppearance(null, false).highContrast).toBe(false)
  })

  it('pins contrast when the tenant chose standard or high', () => {
    expect(toThemeAppearance({ contrast: 'standard' }, true).highContrast).toBe(false)
    expect(toThemeAppearance({ contrast: 'high' }, false).highContrast).toBe(true)
  })
})
