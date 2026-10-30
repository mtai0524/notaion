import PropTypes from 'prop-types';

// Bordered TUI panel with its title chip on the top border.
const Panel = ({ title, focused = false, className = '', children }) => (
  <section className={`eng-panel ${focused ? 'focused' : ''} ${className}`}>
    <span className="eng-panel-title">{title}</span>
    <div className="eng-panel-body">{children}</div>
  </section>
);

Panel.propTypes = {
  title: PropTypes.string.isRequired,
  focused: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

export const EmptyRow = ({ children }) => <div className="eng-empty">{children}</div>;

EmptyRow.propTypes = { children: PropTypes.node.isRequired };

export default Panel;
