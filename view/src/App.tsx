import { Navigate, Route, Routes } from "react-router-dom"

import { LoginPage } from "@/pages/LoginPage"
import { UploadPage } from "@/pages/UploadPage"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
