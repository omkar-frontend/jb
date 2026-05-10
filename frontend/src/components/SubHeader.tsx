import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type SubHeaderProps = {
    title: string;
}

export default function SubHeader({ title }: SubHeaderProps) {
    const navigate = useNavigate();
    return (
        <div className="flex items-center gap-4">
            <button type="button" className="cursor-pointer rounded-full border border-neutral-200 p-2 text-neutral-700 transition-all duration-300 hover:border-neutral-300 hover:bg-neutral-100" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-xl font-semibold text-neutral-900">{title}</p>
        </div>
    )
}