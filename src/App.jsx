import { Routes, Route, useLocation } from "react-router-dom";
import Menu from "./pages/Menu";
import Study from "./pages/Study";
import Results from "./pages/Results";
import Template from "./pages/Template";

function App() {
    const location = useLocation();

    return (
        <Routes>
            <Route path="/" element={<Menu />} />
            <Route path="/Study" element={<Study key={location.key} />} />
            <Route path="/Results" element={<Results />} />
            <Route path="/Template" element={<Template />} />
            <Route path="/Template/:templateId" element={<Template />} />
        </Routes>
    );
}

export default App;