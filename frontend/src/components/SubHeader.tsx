import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type SubHeaderProps = {
    title: string;
}

export default function SubHeader({ title }: SubHeaderProps) {
    const navigate = useNavigate();
    return (
        <div className="flex items-center gap-4">
            <button className="border border-neutral-800 rounded-full p-2 hover:bg-neutral-800 transition-all duration-300 cursor-pointer" onClick={() => navigate(-1)}>
                <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-center text-xl font-semibold">{title}</p>
        </div>
    )
}