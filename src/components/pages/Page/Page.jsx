import { useEffect, useRef } from "react";
import { CustomEditorProvider } from "../../layouts/MenuBar/MenuBar";
import "./Page.scss";
import PropTypes from "prop-types";

const wrapWithDraggableItem = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Create a wrapper for each top-level block element
  doc.body.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const wrapper = doc.createElement("div");
      wrapper.setAttribute("data-type", "draggableItem");
      wrapper.appendChild(node.cloneNode(true));
      node.replaceWith(wrapper);
    }
  });

  return doc.body.innerHTML;
};

const WrappedContent = (html) => {
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      const originalHtml = contentRef.current.innerHTML;
      contentRef.current.innerHTML = wrapWithDraggableItem(originalHtml);
    }
  }, [html]);

  return <div ref={contentRef} dangerouslySetInnerHTML={{ __html: html }} />;
};

const Page = () => {
  const sampleHtml = `
    <h1>Title</h1>
    <p>Paragraph text here</p>
    <div>Some other content</div>
  `; // You should replace this with the actual HTML you want to use.

  return (
    <div className="flex justify-center align-middle">
      <div className="container-content-page m-3">
        <CustomEditorProvider>
          <WrappedContent html={sampleHtml} />
        </CustomEditorProvider>
      </div>
    </div>
  );
};
Page.propTypes = {
  html: PropTypes.string.isRequired,
};
export default Page;
