import { AuthProvider } from "../src/contexts/AuthContext";
import Header from "./components/layouts/Header/Header";
import { BrowserRouter, Navigate } from "react-router-dom";
import { Route, Routes } from "react-router-dom";
import Realtime from "./components/pages/Signal/Signal";
import Notion from "./components/pages/Notion/Notion";
import Login from "./components/pages/Login/Login";
import Register from "./components/pages/Register/Register";
import Profile from "./components/pages/Profile/Profile";
import Page from "./components/pages/Page/Page";
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
            <Route path="/register" element={<Register />} />
            <Route path="/home-page" element={<Notion />} />
            <Route path="/profile/:identifier" element={<Profile />} />
            <Route path="/profile/" element={<Profile />} />
            <Route path="/page/" element={<Page />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </>
  );
};
export default App;
