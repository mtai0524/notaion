import { Switch } from "antd";
import "./Setting.scss";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faEye, faBullseye, faKeyboard, faFillDrip, faMoon, faSun, faFeatherPointed, faMagic, faCode, faGhost } from "@fortawesome/free-solid-svg-icons";

const Setting = () => {
  const [bubble, setBubble] = useState(localStorage.getItem("isBubbleMenuVisible") === "true");
  const [controls, setControls] = useState(localStorage.getItem("isControlsMenuVisible") === "true");
  const [force, setForce] = useState(localStorage.getItem("forceDelete") === "true");
  const [eyeProtection, setEyeProtection] = useState(localStorage.getItem("eyeProtection") === "true");
  const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true");
  const [focusMode, setFocusMode] = useState(localStorage.getItem("focusMode") === "true");
  const [partyMode, setPartyMode] = useState(localStorage.getItem("partyMode") === "true");
  const [hackerMode, setHackerMode] = useState(localStorage.getItem("hackerMode") === "true");
  const [horrorMode, setHorrorMode] = useState(localStorage.getItem("horrorMode") === "true");

  useEffect(() => {
    // Eye Protection
    if (eyeProtection) {
      document.body.classList.add("eye-protection-active");
    } else {
      document.body.classList.remove("eye-protection-active");
    }

    // Dark Mode
    if (darkMode) {
      document.body.classList.add("dark-mode-active");
    } else {
      document.body.classList.remove("dark-mode-active");
    }

    // Focus Mode
    if (focusMode) {
      document.body.classList.add("focus-mode-active");
    } else {
      document.body.classList.remove("focus-mode-active");
    }
    // Hacker Mode
    if (hackerMode) {
      document.body.classList.add("hacker-mode-active");
    } else {
      document.body.classList.remove("hacker-mode-active");
    }

    // Party Mode
    if (partyMode) {
      document.body.classList.add("party-mode-active");
    } else {
      document.body.classList.remove("party-mode-active");
    }

    // Horror Mode
    if (horrorMode) {
      document.body.classList.add("horror-mode-active");
    } else {
      document.body.classList.remove("horror-mode-active");
    }

  }, [eyeProtection, darkMode, focusMode, partyMode, hackerMode, horrorMode]);

  const handleSwitchChange = (key, value) => {
    switch (key) {
      case "bubble":
        setBubble(value);
        localStorage.setItem("isBubbleMenuVisible", value);
        break;
      case "controls":
        setControls(value);
        localStorage.setItem("isControlsMenuVisible", value);
        break;
      case "force":
        setForce(value);
        localStorage.setItem("forceDelete", value);
        break;
      case "eyeProtection":
        setEyeProtection(value);
        localStorage.setItem("eyeProtection", value);
        break;
      case "darkMode":
        setDarkMode(value);
        localStorage.setItem("darkMode", value);
        break;
      case "focusMode":
        setFocusMode(value);
        localStorage.setItem("focusMode", value);
        break;
      case "partyMode":
        setPartyMode(value);
        localStorage.setItem("partyMode", value);
        break;
      case "hackerMode":
        setHackerMode(value);
        localStorage.setItem("hackerMode", value);
        break;
      case "horrorMode":
        setHorrorMode(value);
        localStorage.setItem("horrorMode", value);
        break;
      default:
        break;
    }
  };

  const categories = [
    {
      title: "Interface Settings",
      items: [
        { label: "Menu Bubble", key: "bubble", value: bubble, icon: faBullseye, desc: "Show floating bubble menu in editor" },
        { label: "Menu Controls", key: "controls", value: controls, icon: faKeyboard, desc: "Show static toolbar controls" },
      ]
    },
    {
      title: "Experience Modes",
      items: [
        { label: "Focus Mode", key: "focusMode", value: focusMode, icon: faFeatherPointed, desc: "Hide distractions for deep work" },
        { label: "Eye Protection", key: "eyeProtection", value: eyeProtection, icon: faEye, desc: "Warm colors to reduce eye strain" },
        { label: "Dark Mode", key: "darkMode", value: darkMode, icon: darkMode ? faSun : faMoon, desc: "High contrast dark interface" },
        { label: "Party Mode", key: "partyMode", value: partyMode, icon: faMagic, desc: "Let's get this party started! 🌈" },
        { label: "Hacker Mode", key: "hackerMode", value: hackerMode, icon: faCode, desc: "I'm in. 🕵️‍♂️" },
        { label: "Horror Mode", key: "horrorMode", value: horrorMode, icon: faGhost, desc: "Something is watching you... 👻" },
        { label: "Force Delete", key: "force", value: force, icon: faGear, desc: "Skip confirmation for deletions" },
      ]
    }
  ];

  return (
    <div className="setting-page-wrapper">
      <div className="setting-container">
        <header className="setting-header">
          <h1>Settings <FontAwesomeIcon icon={faGear} spin /></h1>
          <p>Customize your Notaion experience just the way you like it!</p>
        </header>

        <div className="setting-grid">
          {categories.map((cat, idx) => (
            <div key={idx} className="setting-section">
              <h2 className="section-title">{cat.title}</h2>
              <div className="setting-list">
                {cat.items.map((item) => (
                  <div key={item.key} className={`setting-item-card ${item.value ? 'active' : ''}`}>
                    <div className="item-icon">
                      <FontAwesomeIcon icon={item.icon} />
                    </div>
                    <div className="item-info">
                      <span className="item-label">{item.label}</span>
                      <span className="item-desc">{item.desc}</span>
                    </div>
                    <div className="item-action">
                      <Switch
                        checked={item.value}
                        onChange={(checked) => handleSwitchChange(item.key, checked)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="coming-soon">
          <p>More modes coming soon... 🎨✨</p>
        </div>
      </div>
    </div>
  );
};

export default Setting;
