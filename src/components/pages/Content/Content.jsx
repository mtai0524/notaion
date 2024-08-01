import { useParams } from "react-router-dom";
import CustomEditorProvider from "../../layouts/MenuBar/CustomEditorProvider";
import "./Content.scss";

const Content = () => {
  const { id } = useParams();

  return (
    <div className="flex justify-center align-middle">
      <div className="container-content">
        <CustomEditorProvider pageId={id}></CustomEditorProvider>
      </div>
    </div>
  );
};

export default Content;
