import ReactDOM from "react-dom/client";
import "./index.css";
import AppRoutes from "./route";
import Header from "./components/layouts/Header/Header";
import { BrowserRouter } from "react-router-dom";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <>
    <BrowserRouter>
      <Header />
      <AppRoutes />
    </BrowserRouter>
    ,
  </>
);
