import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SubmitPage from "./pages/SubmitPage";
import AdminPage from "./pages/AdminPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/submit" replace />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
