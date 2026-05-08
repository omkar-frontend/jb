import { useParams } from "react-router-dom";
import Adzuna from "./Adzuna";

export default function Portal() {
    const { portal } = useParams();

    return (portal === 'adzuna' ? <Adzuna /> : null)
}