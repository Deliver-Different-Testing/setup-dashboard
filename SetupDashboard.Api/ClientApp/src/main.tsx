import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
// The layered build, so Tailwind's utilities layer still wins where a screen keeps a class.
import '@mantine/core/styles.layer.css'
import './index.css'
import { ColorModeProvider } from './hooks/useColorMode'
import { ThemedApp } from './ThemedApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorModeProvider>
      <ThemedApp />
    </ColorModeProvider>
  </StrictMode>,
)
