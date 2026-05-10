import { Link } from "react-router-dom";

export default function Header() {
    return (
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/95 p-4 text-neutral-900 backdrop-blur-sm">
            <Link to="/">
            <p className="text-center text-xl font-semibold">Jobs <span className="text-emerald-600">Board</span></p>
            </Link>
        </header>
    )
} 