import { useEffect } from 'react'
import type React from 'react'
import { useThemeStore } from '../store/themeStore'

interface ThemeProviderProps {
  children: React.ReactNode
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const theme = useThemeStore((state) => state.theme)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
      window.localStorage.setItem('theme', theme)
    }
  }, [theme])

  return <>{children}</>
}

