import { Outlet } from "react-router-dom";
import Footer from "./Footer";
import Header from "./Header";
import ScrollToTop from "./ScrollToTop";

export default function Layout() {
    return (
        <div>
            <ScrollToTop />
            <Header />
            <Outlet />
            <Footer />
        </div>
    )
}
