import { Link } from "react-router-dom";

export default function Header() {
    return (
        <header className="bg-black text-white p-4 border-b border-neutral-800 sticky top-0 z-10 flex items-center justify-between">
            <Link to="/">
            <p className="text-center text-xl font-semibold">Jobs <span className="text-emerald-500">Board</span></p>
            </Link>
        </header>
    )
} 