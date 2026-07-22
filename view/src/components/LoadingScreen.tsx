import { LoaderCircle } from "lucide-react"

export function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center">
      <LoaderCircle className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
    </div>
  )
}
