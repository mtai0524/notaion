import "./CodeBlockComponent.scss";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import PropTypes from "prop-types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboard } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";

const CodeBlockComponent = ({
  node: {
    attrs: { language: defaultLanguage },
  },
  updateAttributes,
  extension,
}) => {
  const [copied, setCopied] = useState(false);

  const copyCodeBlockContent = () => {
    const codeContent = document.querySelector(".code-block code").innerText;
    navigator.clipboard.writeText(codeContent).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (err) => {
        console.error("Could not copy text: ", err);
      }
    );
  };

  return (
    <NodeViewWrapper className="code-block">
      <div className="code-block-header">
        <select
          contentEditable={false}
          defaultValue={defaultLanguage || "null"}
          onChange={(event) =>
            updateAttributes({ language: event.target.value })
          }
        >
          <option value="null">auto</option>
          <option disabled>—</option>
          {extension.options.lowlight.listLanguages().map((lang, index) => (
            <option key={index} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <button onClick={copyCodeBlockContent} className="copy-button">
          <FontAwesomeIcon className="mr-2" icon={faClipboard} />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
};

CodeBlockComponent.propTypes = {
  node: PropTypes.shape({
    attrs: PropTypes.shape({
      language: PropTypes.string,
    }).isRequired,
  }).isRequired,
  updateAttributes: PropTypes.func.isRequired,
  extension: PropTypes.shape({
    options: PropTypes.shape({
      lowlight: PropTypes.shape({
        listLanguages: PropTypes.func.isRequired,
      }).isRequired,
    }).isRequired,
  }).isRequired,
};

export default CodeBlockComponent;
