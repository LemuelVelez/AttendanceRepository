import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { Toaster } from "sonner"

import App from "@/App"
import { LoadingScreen } from "@/components/LoadingScreen"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext"
import "@/index.css"

function Application() {
  const { loading } = useAuth()
  if (loading) return <LoadingScreen />
  return <App />
}

function ThemedToaster() {
  const { darkMode } = useTheme()
  return <Toaster richColors position="top-right" theme={darkMode ? "dark" : "light"} />
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Application />
          <ThemedToaster />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
