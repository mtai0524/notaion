import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./components/pages/Home/Home";
import Realtime from "./components/pages/Signal/Signal";
const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Home backgroundColor="red" title="home1" message="home1" />}
        />
        <Route
          path="/home2"
          element={
            <Home backgroundColor="yellow" title="home2" message="home2 ne" />
          }
        />
        <Route path="/signal" element={<Realtime />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
