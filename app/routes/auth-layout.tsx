import { Outlet } from "react-router"

const AuthLayout = () => (
  <div className="grid min-h-screen place-items-center bg-page p-6">
    <div className="w-full max-w-sm">
      <Outlet />
    </div>
  </div>
)

export default AuthLayout
