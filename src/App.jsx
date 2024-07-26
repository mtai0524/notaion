import { AuthProvider } from "../src/contexts/AuthContext";
import Header from "./components/layouts/Header/Header";
import { BrowserRouter, Navigate } from "react-router-dom";
import { Route, Routes } from "react-router-dom";
import Realtime from "./components/pages/Signal/Signal";
import Notion from "./components/pages/Notion/Notion";
import Login from "./components/pages/Login/Login";
const App = () => {
  return (
    <>
      <AuthProvider>
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/" element={<Navigate to="/home-page" />} />
            <Route path="/signal" element={<Realtime />} />
            <Route path="/login" element={<Login />} />
            <Route path="/home-page" element={<Notion />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </>
  );
};
export default App;
