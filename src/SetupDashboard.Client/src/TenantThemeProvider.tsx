import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Center, Loader, MantineProvider } from '@mantine/core';
import { useColorMode } from './hooks/colorModeContext';
import { usePrefersMoreContrast } from './hooks/usePrefersMoreContrast';
import { parseAppearanceSettings, toThemeAppearance, type AppearanceSettings } from './styles/appearance';
import { createDfrntTheme, dfrntCssVariablesResolver } from './styles/mantineTheme';

/**
 * Themes the app from the tenant's Branding (tblSetting.AppearanceDefaultsJson) on top of the built-in
 * DFRNT cyan / Ink theme. Pass the signed-in tenant and a fetcher for the app's own read-only appearance
 * endpoint. Signed in, nothing renders until the lookup resolves, so a branded tenant never flashes cyan;
 * signed out (anonymous routes) renders straight away in the built-in theme. A failed or empty lookup
 * (204 / null) also means built-in.
 */
export default function TenantThemeProvider({
  tenantId,
  fetchAppearance,
  children,
}: {
  /** Null/undefined when signed out or the tenant is not known yet. */
  tenantId: number | string | null | undefined;
  /** GET the tenant's appearance blob; resolve null when none is set. */
  fetchAppearance: () => Promise<unknown>;
  children: ReactNode;
}) {
  const { mode } = useColorMode();
  const signedIn = tenantId !== null && tenantId !== undefined;
  const [settings, setSettings] = useState<AppearanceSettings | null>(null);
  const [loading, setLoading] = useState(signedIn);
  const systemPrefersMore = usePrefersMoreContrast();

  useEffect(() => {
    if (!signedIn) {
      setSettings(null);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    fetchAppearance()
      .then((raw) => live && setSettings(parseAppearanceSettings(raw)))
      .catch(() => live && setSettings(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // Refetch per tenant only; a new fetcher identity on re-render must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, tenantId]);

  const appearance = useMemo(() => toThemeAppearance(settings, systemPrefersMore), [settings, systemPrefersMore]);
  const theme = useMemo(() => createDfrntTheme(appearance), [appearance]);

  // Hook for the rules in highContrast.css that CSS variables can't express.
  useEffect(() => {
    document.documentElement.dataset.ddContrast = appearance.highContrast ? 'high' : 'standard';
  }, [appearance.highContrast]);

  return (
    <MantineProvider theme={theme} forceColorScheme={mode} cssVariablesResolver={dfrntCssVariablesResolver}>
      {loading ? (
        <Center mih="100vh" w="100%">
          <Loader color="gray" aria-label="Loading" />
        </Center>
      ) : (
        children
      )}
    </MantineProvider>
  );
}
