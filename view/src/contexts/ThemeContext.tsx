import * as React from "react"

type ThemeContextValue = { darkMode: boolean; toggleTheme: () => void }

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

const LIGHT_THEME_COLOR = "#f8fafc"
const DARK_THEME_COLOR = "#090e1a"

function getStoredDarkMode() {
  try {
    const storedTheme = localStorage.getItem("theme") || localStorage.getItem("darkMode")
    return storedTheme === "dark" || storedTheme === "true"
  } catch {
    return document.documentElement.classList.contains("dark")
  }
}

function applyTheme(darkMode: boolean) {
  const root = document.documentElement
  root.classList.toggle("dark", darkMode)
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", darkMode ? DARK_THEME_COLOR : LIGHT_THEME_COLOR)

  try {
    localStorage.setItem("theme", darkMode ? "dark" : "light")
  } catch {
    // Ignore storage errors; the applied document theme is still valid for this session.
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = React.useState(getStoredDarkMode)
  const switchFrame = React.useRef<number | null>(null)

  React.useLayoutEffect(() => {
    applyTheme(darkMode)
  }, [darkMode])

  React.useEffect(
    () => () => {
      if (switchFrame.current !== null) cancelAnimationFrame(switchFrame.current)
    },
    [],
  )

  const toggleTheme = React.useCallback(() => {
    const next = !darkMode
    const root = document.documentElement

    if (switchFrame.current !== null) cancelAnimationFrame(switchFrame.current)
    root.classList.add("theme-switching")
    applyTheme(next)
    void root.offsetHeight
    setDarkMode(next)
    switchFrame.current = requestAnimationFrame(() => {
      root.classList.remove("theme-switching")
      switchFrame.current = null
    })
  }, [darkMode])

  return <ThemeContext.Provider value={{ darkMode, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used inside ThemeProvider")
  return context
}
