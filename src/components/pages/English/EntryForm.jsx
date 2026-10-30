import { useState } from 'react';
import PropTypes from 'prop-types';

// Modal form for a card, sentence or text. Enter saves (Ctrl+Enter inside a
// multi-line field), Esc cancels. The first field is required.
const EntryForm = ({ title, fields, initial = {}, onSave, onCancel }) => {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.name, initial[field.name] || ''])));
  const firstField = fields[0].name;
  const canSave = values[firstField].trim() !== '';

  const save = () => {
    if (!canSave) return;
    onSave(Object.fromEntries(Object.entries(values).map(([name, value]) => [name, value.trim()])));
  };

  const onKeyDown = (e, multiline) => {
    e.stopPropagation();
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && (!multiline || e.ctrlKey)) {
      e.preventDefault();
      save();
    }
  };

  return (
    <div className="eng-modal-backdrop" onClick={onCancel}>
      <form className="eng-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <span className="eng-chip on">{title}</span>
        {fields.map((field, index) => {
          const Input = field.multiline ? 'textarea' : 'input';
          return (
            <label key={field.name} className="eng-field">
              <span>{field.label}</span>
              <Input value={values[field.name]} autoFocus={index === 0} rows={field.multiline ? 8 : undefined}
                     placeholder={field.placeholder}
                     onChange={(e) => setValues((current) => ({ ...current, [field.name]: e.target.value }))}
                     onKeyDown={(e) => onKeyDown(e, field.multiline)} />
            </label>
          );
        })}
        <div className="eng-modal-actions">
          <span className="eng-dim">enter: save · esc: cancel</span>
          <button type="button" className="eng-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="eng-btn on" disabled={!canSave}>Save</button>
        </div>
      </form>
    </div>
  );
};

EntryForm.propTypes = {
  title: PropTypes.string.isRequired,
  fields: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    placeholder: PropTypes.string,
    multiline: PropTypes.bool,
  })).isRequired,
  initial: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default EntryForm;
