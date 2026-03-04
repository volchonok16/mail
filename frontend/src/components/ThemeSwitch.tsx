import { Sun, Moon } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'

export function ThemeSwitch() {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)

  const isLight = theme === 'light'

  return (
    <button
      type="button"
      className={`theme-switch ${isLight ? 'theme-switch--light' : ''}`}
      onClick={toggleTheme}
      aria-label={isLight ? 'Включить тёмную тему' : 'Включить светлую тему'}
    >
      <span className="theme-switch__label">
        {isLight ? 'Светлая' : 'Тёмная'}
      </span>
      <span className="theme-switch__track">
        <span className="theme-switch__thumb" />
      </span>
      <span className="theme-switch__icon">
        {isLight ? <Sun size={16} /> : <Moon size={16} />}
      </span>
    </button>
  )
}

