import { useEffect, useRef } from "react";
import PropTypes from "prop-types";

const HtmlRenderer = ({ htmlContent }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = htmlContent;
    }
  }, [htmlContent]);

  return <div ref={containerRef} />;
};

HtmlRenderer.propTypes = {
  htmlContent: PropTypes.string.isRequired,
};

export default HtmlRenderer;
