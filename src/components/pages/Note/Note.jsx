import React, { useState } from 'react';
import Draggable from 'react-draggable';
import { FaThumbtack } from 'react-icons/fa'; // Icon pin from react-icons
import { Dropdown, Menu, Button, message } from 'antd'; // Import Dropdown, Menu, Button from antd
import { ResizableBox } from 'react-resizable'; // Import ResizableBox from react-resizable
import 'react-resizable/css/styles.css'; // Import the styles for resizable
import './Note.scss'; // Ensure the styles are included

const Note = ({ id, title, content, color, onChangeColor, onDelete, onChangeContent }) => {
    const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
    const [showColorMenu, setShowColorMenu] = useState(false);
    const [dragging, setDragging] = useState(true);
    const [resizable, setResizable] = useState(false);

    // State to handle whether the note is in edit mode
    const [isEditing, setIsEditing] = useState(false);
    const [newContent, setNewContent] = useState(content); // Temporary content for editing

    // Function to handle color change when an option is selected
    const handleMenuClick = (e) => {
        const newColor = e.key; // Get the color from the key of the clicked item
        onChangeColor(id, newColor); // Update the color of the note
        setShowColorMenu(false); // Close the background color menu after selection
    };

    // Menu items for "Change Background" and "Delete"
    const menu = (
        <Menu>
            <Menu.Item key="changeBackground" onClick={() => {
                setShowColorMenu(!showColorMenu);
            }}>
                Change Background
            </Menu.Item>
            <Menu.Item key="resize" onClick={() => {
                setResizable(!resizable); // Toggle the resizable state
            }}>
                Resize
            </Menu.Item>
            <Menu.Item key="delete" onClick={() => onDelete(id)}>
                Delete
            </Menu.Item>
        </Menu>
    );

    // Menu items for selecting background color
    const backgroundMenu = (
        <Menu onClick={handleMenuClick}>
            <Menu.Item key="lightyellow" className="light-yellow">
                Light Yellow
            </Menu.Item>
            <Menu.Item key="lightgreen" className="light-green">
                Light Green
            </Menu.Item>
            <Menu.Item key="lightblue" className="light-blue">
                Light Blue
            </Menu.Item>
            <Menu.Item key="lightpink" className="light-pink">
                Light Pink
            </Menu.Item>
            <Menu.Item key="lightcoral" className="light-coral">
                Light Coral
            </Menu.Item>
        </Menu>
    );

    // Handle text click to enter edit mode
    const handleTextClick = () => {
        setIsEditing(true);
    };

    // Save content when Enter is pressed or user clicks out of the note
    const handleSaveContent = () => {
        onChangeContent(id, newContent); // Save content to the parent component
        setIsEditing(false); // Switch back to display mode
    };

    const handleBlur = () => {
        handleSaveContent(); // Save content when focus leaves the note
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSaveContent(); // Save content on Enter press
        }
    };

    // Function to handle content change during editing
    const handleContentChange = (e) => {
        setNewContent(e.target.value);
    };

    return (
        <Draggable disabled={resizable}>
            <div className="note" style={{ backgroundColor: color }}>
                <div className="note-pin">
                    <FaThumbtack size={20} />
                </div>

                <div className="dropdown-container">
                    <Dropdown
                        overlay={menu}
                        trigger={['click']}
                        placement="bottomRight"
                        onVisibleChange={(visible) => setShowBackgroundMenu(visible)}
                        visible={showBackgroundMenu}
                    >
                        <a className="button-note-dropdown">...</a>
                    </Dropdown>

                    <Dropdown
                        overlay={backgroundMenu}
                        trigger={['click']}
                        placement="bottomLeft"
                        onVisibleChange={(visible) => setShowColorMenu(visible)}
                        visible={showColorMenu}
                        className="hidden-button"
                    >
                        <Button> Select Color </Button>
                    </Dropdown>
                </div>

                {/* Resizable Box */}
                <ResizableBox
                    width={300}
                    height={200}
                    axis="both"
                    minConstraints={[250, 150]}
                    maxConstraints={[500, 500]}
                    resizeHandles={['se']}
                    className="resizable-box"
                    onResizeStart={() => {
                        setDragging(false);
                    }}
                    onResizeStop={() => {
                        setDragging(true);
                        setResizable(false);
                    }}
                >
                    <h3>{title}</h3>

                    {/* Content of the note */}
                    <div onClick={handleTextClick}>
                        {isEditing ? (
                            <textarea
                                value={newContent}
                                onChange={handleContentChange}
                                onBlur={handleBlur}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                className="note-content-edit"
                            />
                        ) : (
                            <p>{newContent}</p>
                        )}
                    </div>
                </ResizableBox>
            </div>
        </Draggable>
    );
};


const NoteApp = () => {
    const [notes, setNotes] = useState([
        { id: 1, title: 'Note 1', content: 'This is the first note', color: 'lightyellow' },
        { id: 2, title: 'Note 2', content: 'This is the second note', color: 'lightgreen' },
    ]);

    const changeNoteColor = (id, newColor) => {
        const newNotes = notes.map(note => {
            if (note.id === id) {
                return { ...note, color: newColor };
            }
            return note;
        });
        setNotes(newNotes);
    };

    const deleteNote = (id) => {
        const newNotes = notes.filter(note => note.id !== id);
        setNotes(newNotes);
        message.success('Note deleted!');
    };

    const changeNoteContent = (id, newContent) => {
        const newNotes = notes.map(note => {
            if (note.id === id) {
                return { ...note, content: newContent };
            }
            return note;
        });
        setNotes(newNotes);
    };

    return (
        <div className="note-container">
            {notes.map(note => (
                <Note
                    key={note.id}
                    id={note.id}
                    title={note.title}
                    content={note.content}
                    color={note.color}
                    onChangeColor={changeNoteColor}
                    onDelete={deleteNote}
                    onChangeContent={changeNoteContent} // Pass the content change handler
                />
            ))}
        </div>
    );
};

export default NoteApp;
