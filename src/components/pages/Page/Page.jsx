import { CustomEditorProvider } from "../../layouts/MenuBar/MenuBar";
import "./Page.scss";

const Page = () => {
  return (
    <div className="flex justify-center align-middle">
      <div className="container-content-page m-3">
        <CustomEditorProvider></CustomEditorProvider>
      </div>
    </div>
  );
};

export default Page;
