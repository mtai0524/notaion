import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import Realtime from "./components/pages/Signal/Signal";
import Notion from "./components/pages/Notion/Notion";
const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/notion" />} />
        <Route path="/signal" element={<Realtime />} />
        <Route path="/notion" element={<Notion />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
