/**
 * DFRNT light/dark colour mode: the context and hook, split from the provider
 * (useColorMode.tsx) so react-refresh's "only export components" rule holds.
 */
import { createContext, useContext } from 'react';
import type { Md3Mode } from '../styles/md3';

export type ColorModePreference = Md3Mode | 'system';

export interface ColorModeContextValue {
  mode: Md3Mode;
  preference: ColorModePreference;
  setPreference: (preference: ColorModePreference) => void;
}

const DEFAULT_VALUE: ColorModeContextValue = {
  mode: 'light',
  preference: 'system',
  setPreference: () => {},
};

export const ColorModeContext = createContext<ColorModeContextValue>(DEFAULT_VALUE);

export function useColorMode(): ColorModeContextValue {
  return useContext(ColorModeContext);
}
