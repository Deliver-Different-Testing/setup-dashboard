import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import '@mantine/core/styles.css'
import './styles/highContrast.css'
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
