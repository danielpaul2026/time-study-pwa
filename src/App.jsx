import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

import Menu from "./pages/Menu";
import Study from "./pages/Study";
import Results from "./pages/Results";

export default function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Menu</Link> |{" "}
        <Link to="/study">Study</Link> |{" "}
        <Link to="/results">Results</Link> |{" "}
      </nav>

      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/study" element={<Study />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </BrowserRouter>
  );
}