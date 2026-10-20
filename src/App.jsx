import { Routes, Route } from "react-router-dom";
import Menu from "./pages/Menu";
import Study from "./pages/Study";
import Results from "./pages/Results";

function App() {
    return (
        <Routes>
            <Route path="/" element={<Menu />} />
            <Route path="/Study" element={<Study />} />
            <Route path="/Results" element={<Results />} />
        </Routes>
    );
}

export default App;