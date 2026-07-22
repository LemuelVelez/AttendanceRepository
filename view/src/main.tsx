import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { Toaster } from "sonner"

import App from "@/App"
import { LoadingScreen } from "@/components/LoadingScreen"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import "@/index.css"

function Application() {
  const { loading } = useAuth()
  if (loading) return <LoadingScreen />
  return <App />
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Application />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
