import { Route, Routes, Navigate } from "react-router-dom";
import Realtime from "./components/pages/Signal/Signal";
import Notion from "./components/pages/Notion/Notion";
import Login from "./components/pages/Login/Login";
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home-page" />} />
      <Route path="/signal" element={<Realtime />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/home-page" element={<Notion />} />
    </Routes>
  );
};

export default AppRoutes;
