import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./components/pages/Home/Home";
import Realtime from "./components/pages/Signal/Signal";
import Notion from "./components/pages/Notion/Notion";
const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Home backgroundColor="bg-red-400" title="home1" message="home1" />
          }
        />
        <Route
          path="/home2"
          element={
            <Home
              backgroundColor="bg-yellow-100"
              title="home2"
              message="home2 ne"
            />
          }
        />
        <Route path="/signal" element={<Realtime />} />
        <Route path="/notion" element={<Notion />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
