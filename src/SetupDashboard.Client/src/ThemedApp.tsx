import { HashRouter, Route, Routes } from 'react-router-dom'
import App from './App'
import TenantThemeProvider from './TenantThemeProvider'
import * as api from './lib/api'

// Every route needs the Hub cookie, and the server takes the tenant from it, so the page is always
// signed in to the one tenant. Keying on it (rather than on the store's `me`, which arrives after
// App mounts) fetches the Branding once up front and never remounts App to swap themes.
const COOKIE_TENANT = 'hub-cookie'

/**
 * The DFRNT theme in the chosen light/dark mode, in the tenant's Branding (primary, secondary,
 * text colours, contrast) when it has one saved - else DFRNT cyan / Ink.
 */
export function ThemedApp() {
  return (
    <TenantThemeProvider tenantId={COOKIE_TENANT} fetchAppearance={api.getTenantAppearance}>
      <HashRouter>
        <Routes>
          <Route path="*" element={<App />} />
        </Routes>
      </HashRouter>
    </TenantThemeProvider>
  )
}
