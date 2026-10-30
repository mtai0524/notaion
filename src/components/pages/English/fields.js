import PropTypes from 'prop-types';

// Form fields of each entry kind, and the list actions every tab receives.
export const CARD_FIELDS = [
  { name: 'front', label: 'word / phrase', placeholder: 'resilient' },
  { name: 'back', label: 'meaning', placeholder: 'kiên cường, mau phục hồi' },
  { name: 'example', label: 'example', placeholder: 'Small teams are often more resilient.' },
];

export const SENTENCE_FIELDS = [
  { name: 'en', label: 'english', placeholder: "We're on the same page." },
  { name: 'vi', label: 'meaning', placeholder: 'Chúng ta đã hiểu ý nhau.' },
  { name: 'tag', label: 'tag', placeholder: 'work' },
];

export const TEXT_FIELDS = [
  { name: 'body', label: 'text', placeholder: 'Paste an article or a passage…', multiline: true },
  { name: 'title', label: 'title', placeholder: 'Remote work' },
];

// add / update / remove from useEnglishData.
export const listProps = {
  add: PropTypes.func.isRequired,
  update: PropTypes.func.isRequired,
  remove: PropTypes.func.isRequired,
};
