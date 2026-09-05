import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Loader, LogOut, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

export default function Header() {
    const { user, loading, signOut } = useAuth()
    const [accountMenuOpen, setAccountMenuOpen] = useState(false)
    const userLabel = user?.email ?? 'User'
    const initials = userLabel.slice(0, 1).toUpperCase()

    return (
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-neutral-200 bg-white/95 px-3 py-3 text-neutral-900 backdrop-blur-sm sm:p-4">
            <Link to="/" className="min-w-0 shrink">
                <p className="truncate text-lg font-semibold sm:text-xl">
                    Jobs <span className="text-emerald-600">Board</span>
                </p>
            </Link>

            {/* shrink-0: the nav keeps its size and the brand truncates instead */}
            <nav className="flex shrink-0 items-center gap-2 sm:gap-4">
                {loading ? (
                    <Loader className="h-5 w-5 animate-spin text-neutral-400" aria-label="Loading" />
                ) : user ? (
                    <>
                        <Link
                            to="/details"
                            className="cmn-button-secondary max-sm:px-2.5"
                        >
                            <FileText className="h-4 w-4 shrink-0" aria-hidden />
                            {/* sr-only rather than hidden: the link keeps its
                                accessible name when the label is not painted. */}
                            <span className="max-sm:sr-only">CV Details</span>
                        </Link>
                        <Popover open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
                            <PopoverTrigger
                                aria-label="Open account menu"
                                className="rounded-full outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-emerald-600"
                            >
                                <Avatar size="default" className='outline outline-emerald-200 outline-offset-2'>
                                    <AvatarFallback className="border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-48 p-1.5 *:transition-colors mt-1">
                                <Link
                                    to="/profile"
                                    onClick={() => setAccountMenuOpen(false)}
                                    className="inline-flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 cursor-default"
                                >
                                    <User className="h-4 w-4" aria-hidden />
                                    Profile
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAccountMenuOpen(false)
                                        void signOut()
                                    }}
                                    className="inline-flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-rose-400 hover:bg-red-50"
                                >
                                    <LogOut className="h-4 w-4" aria-hidden />
                                    Sign out
                                </button>
                            </PopoverContent>
                        </Popover>
                    </>
                ) : (
                    <>
                        <Link
                            to="/login"
                            className="cmn-button-text max-sm:px-2.5"
                        >
                            Sign in
                        </Link>
                        <Link
                            to="/signup"
                            className="cmn-button max-sm:px-3"
                        >
                            Sign up
                        </Link>
                    </>
                )}
            </nav>
        </header>
    )
}
