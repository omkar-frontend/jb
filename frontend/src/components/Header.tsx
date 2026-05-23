import { Link } from 'react-router-dom'
import { FileText, Loader2, LogOut, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Header() {
    const { user, loading, signOut } = useAuth()

    return (
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/95 p-4 text-neutral-900 backdrop-blur-sm">
            <Link to="/">
                <p className="text-center text-xl font-semibold">
                    Jobs <span className="text-emerald-600">Board</span>
                </p>
            </Link>

            <nav className="flex items-center gap-3">
                {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-400" aria-label="Loading" />
                ) : user ? (
                    <>
                        <Link
                            to="/details"
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                        >
                            <FileText className="h-4 w-4" aria-hidden />
                            Details
                        </Link>
                        <Link
                            to="/profile"
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                        >
                            <User className="h-4 w-4" aria-hidden />
                            Profile
                        </Link>
                        <button
                            type="button"
                            onClick={() => void signOut()}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                            <LogOut className="h-4 w-4" aria-hidden />
                            Sign out
                        </button>
                    </>
                ) : (
                    <>
                        <Link
                            to="/login"
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                        >
                            Sign in
                        </Link>
                        <Link
                            to="/signup"
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                            Sign up
                        </Link>
                    </>
                )}
            </nav>
        </header>
    )
}
