import * as React from "react"

type ThemeContextValue = { darkMode: boolean; toggleTheme: () => void }

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = React.useState(() => localStorage.getItem("theme") === "dark")

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode)
    localStorage.setItem("theme", darkMode ? "dark" : "light")
  }, [darkMode])

  return <ThemeContext.Provider value={{ darkMode, toggleTheme: () => setDarkMode((v) => !v) }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used inside ThemeProvider")
  return context
}
