import { Routes, Route } from "react-router-dom";
import Menu from "./pages/Menu";
import Study from "./pages/Study";
import Results from "./pages/Results";
import Template from "./pages/Template";

function App() {
    return (
        <Routes>
            <Route path="/" element={<Menu />} />
            <Route path="/Study" element={<Study />} />
            <Route path="/Results" element={<Results />} />
            <Route path="/Template" element={<Template />} />
            <Route path="/Template/:templateId" element={<Template />} />
        </Routes>
    );
}

export default App;