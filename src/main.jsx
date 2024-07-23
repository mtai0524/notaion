import ReactDOM from "react-dom/client";
import "./index.css";
import AppRoutes from "./route";
import Header from "./components/layouts/Header/Header";

ReactDOM.createRoot(document.getElementById("root")).render(
  <>
    <Header />
    <AppRoutes />
  </>
);
