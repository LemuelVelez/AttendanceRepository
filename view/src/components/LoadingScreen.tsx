import { LoaderCircle } from "lucide-react"

import logo from "@/assets/images/logo.png"

export function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="relative grid h-20 w-20 place-items-center" role="status" aria-label="Loading">
        <LoaderCircle className="absolute h-20 w-20 animate-spin text-primary" aria-hidden="true" />
        <img src={logo} alt="" className="h-10 w-10 rounded-full object-contain" />
      </div>
    </div>
  )
}
