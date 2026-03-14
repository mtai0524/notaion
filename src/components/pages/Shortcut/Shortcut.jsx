import React from 'react';
import './Shortcut.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKeyboard, faArrowLeft, faHeading, faBold, faItalic, faCode, faListOl, faListUl, faQuoteLeft, faUndo, faRedo, faStrikethrough, faUnderline, faMinus, faHighlighter, faListCheck, faEraser, faMagic } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';

const Shortcut = () => {
    const navigate = useNavigate();

    const shortcuts = [
        { section: "System (Manual)", items: [
            { keys: ["/"], desc: "Open selection menu (Heading, Image...)" },
            { keys: ["Enter"], desc: "Add new line" },
            { keys: ["Ctrl", "1"], desc: "Heading 1" },
            { keys: ["Ctrl", "2"], desc: "Heading 2" },
            { keys: ["Ctrl", "3"], desc: "Heading 3" },
            { keys: ["Ctrl", "4"], desc: "Code Block" },
            { keys: ["Ctrl", "D"], desc: "Delete current line" },
        ]},
        { section: "Editor (Tiptap Hotkeys)", items: [
            { keys: ["Mod", "B"], desc: "Bold", icon: faBold },
            { keys: ["Mod", "I"], desc: "Italic", icon: faItalic },
            { keys: ["Mod", "U"], desc: "Underline", icon: faUnderline },
            { keys: ["Mod", "Shift", "S"], desc: "Strikethrough", icon: faStrikethrough },
            { keys: ["Mod", "E"], desc: "Inline Code", icon: faCode },
            { keys: ["Mod", "Shift", "H"], desc: "Highlight", icon: faHighlighter },
            { keys: ["Mod", "Shift", "8"], desc: "Bullet List", icon: faListUl },
            { keys: ["Mod", "Shift", "7"], desc: "Ordered List", icon: faListOl },
            { keys: ["Mod", "Shift", "9"], desc: "Task List", icon: faListCheck },
            { keys: ["Mod", "Alt", "C"], desc: "Code Block", icon: faCode },
            { keys: ["Mod", "Shift", "B"], desc: "Blockquote", icon: faQuoteLeft },
            { keys: ["Mod", "Shift", "0"], desc: "Clear formatting", icon: faEraser },
            { keys: ["Mod", "Z"], desc: "Undo", icon: faUndo },
            { keys: ["Mod", "Shift", "Z"], desc: "Redo", icon: faRedo },
        ]},
        { section: "Input Tricks (Auto-formatting)", items: [
            { keys: ["#", "Space"], desc: "Create Heading 1" },
            { keys: ["##", "Space"], desc: "Create Heading 2" },
            { keys: ["###", "Space"], desc: "Create Heading 3" },
            { keys: [">", "Space"], desc: "Create Blockquote" },
            { keys: ["*", "Space"], desc: "Create Bullet List" },
            { keys: ["1.", "Space"], desc: "Create Ordered List" },
            { keys: ["-", "-", "-"], desc: "Create horizontal rule", icon: faMinus },
            { keys: ["`", "text", "`"], desc: "Apply inline code" },
            { keys: ["```"], desc: "Create Code Block", icon: faCode },
            { keys: ["[", " ", "]"], desc: "Create Task List", icon: faListCheck },
        ]},
    ];

    return (
        <div className="shortcut-page">
            <button className="back-btn" onClick={() => navigate(-1)}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back
            </button>

            <header className="shortcut-header">
                <h1 className="sketch-title">Shortcut Board <FontAwesomeIcon icon={faKeyboard} /></h1>
                <p className="sketch-subtitle">Master Notaion with these ultimate keyboard shortcuts!</p>
            </header>

            <div className="shortcut-container">
                {shortcuts.map((group, idx) => (
                    <div key={idx} className={`shortcut-section section-${idx}`}>
                        <h2 className="section-title">{group.section}</h2>
                        <div className="shortcut-list">
                            {group.items.map((item, i) => (
                                <div key={i} className="shortcut-card">
                                    <div className="keys">
                                        {item.keys.map((key, kidx) => (
                                            <React.Fragment key={kidx}>
                                                <kbd className={key === "Mod" ? "mod-key" : ""}>
                                                    {key === "Mod" ? (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl') : key}
                                                </kbd>
                                                {kidx < item.keys.length - 1 && <span className="plus">+</span>}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    <div className="info">
                                        <span className="desc">{item.desc}</span>
                                        {item.icon && <FontAwesomeIcon icon={item.icon} className="item-icon" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="pro-tip">
                <p>💡 <b>Pro Tip:</b> Use <b>Ctrl</b> on Windows and <b>Command (⌘)</b> on Mac!</p>
            </div>
        </div>
    );
};

export default Shortcut;
