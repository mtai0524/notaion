import "./CodeBlockComponent.scss";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import PropTypes from "prop-types";

const CodeBlockComponent = ({
  node: {
    attrs: { language: defaultLanguage },
  },
  updateAttributes,
  extension,
}) => {
  return (
    <NodeViewWrapper className="code-block">
      <select
        contentEditable={false}
        defaultValue={defaultLanguage || "null"}
        onChange={(event) => updateAttributes({ language: event.target.value })}
      >
        <option value="null">auto</option>
        <option disabled>—</option>
        {extension.options.lowlight.listLanguages().map((lang, index) => (
          <option key={index} value={lang}>
            {lang}
          </option>
        ))}
      </select>
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
