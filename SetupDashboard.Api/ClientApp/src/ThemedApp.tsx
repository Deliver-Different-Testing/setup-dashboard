import { MantineProvider } from '@mantine/core'
import { HashRouter, Route, Routes } from 'react-router-dom'
import App from './App'
import { dfrntCssVariablesResolver, dfrntTheme } from './styles/mantineTheme'
import { useColorMode } from './hooks/colorModeContext'

/**
 * The DFRNT theme in the chosen light/dark mode. DFRNT cyan for every tenant: this is DFRNT's
 * onboarding tool, not a tenant-branded app.
 */
export function ThemedApp() {
  const { mode } = useColorMode()
  return (
    <MantineProvider theme={dfrntTheme} forceColorScheme={mode} cssVariablesResolver={dfrntCssVariablesResolver}>
      <HashRouter>
        <Routes>
          <Route path="*" element={<App />} />
        </Routes>
      </HashRouter>
    </MantineProvider>
  )
}
