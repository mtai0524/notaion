import { Switch, Tooltip } from "antd";
import "./Setting.scss";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faEye, faBullseye, faKeyboard, faFillDrip, faMoon, faSun, faFeatherPointed, faMagic, faCode, faGhost, faImage, faDesktop, faPalette } from "@fortawesome/free-solid-svg-icons";

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

  const [globalBorderColor, setGlobalBorderColor] = useState(localStorage.getItem("globalBorderColor") || "#111827");
  const [globalBorderStyle, setGlobalBorderStyle] = useState(localStorage.getItem("globalBorderStyle") || "solid");
  const [globalBorderWidth, setGlobalBorderWidth] = useState(localStorage.getItem("globalBorderWidth") || "2px");
  const [globalBorderRadius, setGlobalBorderRadius] = useState(localStorage.getItem("globalBorderRadius") || "0px");
  const [globalBgTheme, setGlobalBgTheme] = useState(localStorage.getItem("globalBgTheme") || "theme-none");
  const [globalBgScope, setGlobalBgScope] = useState(localStorage.getItem("globalBgScope") || "all");
  const [globalShadowX, setGlobalShadowX] = useState(localStorage.getItem("globalShadowX") || "-4px");
  const [globalShadowY, setGlobalShadowY] = useState(localStorage.getItem("globalShadowY") || "4px");

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

    document.documentElement.style.setProperty('--global-border-color', globalBorderColor);
    document.documentElement.style.setProperty('--global-border-style', globalBorderStyle);
    document.documentElement.style.setProperty('--global-border-width', globalBorderWidth);
    document.documentElement.style.setProperty('--global-border-radius', globalBorderRadius);

    document.body.classList.remove("theme-dots", "theme-grid", "theme-paper", "theme-blueprint", "theme-cross", "theme-waves", "theme-notebook", "theme-none", "bg-scope-all", "bg-scope-base");
    if (globalBgTheme && globalBgTheme !== "theme-none") {
      document.body.classList.add(globalBgTheme);
      document.body.classList.add(`bg-scope-${globalBgScope}`);
    }

    document.documentElement.style.setProperty('--global-shadow-x', globalShadowX);
    document.documentElement.style.setProperty('--global-shadow-y', globalShadowY);
  }, [eyeProtection, darkMode, focusMode, partyMode, hackerMode, horrorMode, globalBorderColor, globalBorderStyle, globalBorderWidth, globalBorderRadius, globalShadowX, globalShadowY, globalBgTheme, globalBgScope]);

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

  const handleStyleChange = (key, value) => {
    if (key === 'borderColor') {
      setGlobalBorderColor(value);
      localStorage.setItem("globalBorderColor", value);
    } else if (key === 'borderStyle') {
      setGlobalBorderStyle(value);
      localStorage.setItem("globalBorderStyle", value);
    } else if (key === 'borderWidth') {
      setGlobalBorderWidth(value);
      localStorage.setItem("globalBorderWidth", value);
    } else if (key === 'borderRadius') {
      setGlobalBorderRadius(value);
      localStorage.setItem("globalBorderRadius", value);
    } else if (key === 'bgTheme') {
      setGlobalBgTheme(value);
      localStorage.setItem("globalBgTheme", value);
    } else if (key === 'bgScope') {
      setGlobalBgScope(value);
      localStorage.setItem("globalBgScope", value);
    } else if (key === 'shadowX') {
      setGlobalShadowX(value);
      localStorage.setItem("globalShadowX", value);
    } else if (key === 'shadowY') {
      setGlobalShadowY(value);
      localStorage.setItem("globalShadowY", value);
    }
  };

  const applyPreset = (preset) => {
    let styles = {};
    switch (preset) {
      case 'Omarchy':
        styles = { borderColor: '#111827', borderStyle: 'solid', borderWidth: '1px', borderRadius: '4px', bgTheme: 'theme-none' };
        break;
      case 'Sketchy':
        styles = { borderColor: '#111827', borderStyle: 'solid', borderWidth: '3px', borderRadius: '0px', bgTheme: 'theme-paper' };
        break;
      case 'Minimal':
        styles = { borderColor: '#e5e7eb', borderStyle: 'solid', borderWidth: '1px', borderRadius: '8px', bgTheme: 'theme-none' };
        break;
      case 'Cyber':
        styles = { borderColor: '#00ff00', borderStyle: 'dashed', borderWidth: '2px', borderRadius: '0px', bgTheme: 'theme-grid' };
        break;
      default:
        return;
    }
    
    Object.keys(styles).forEach(key => handleStyleChange(key, styles[key]));
  };

  const categories = [
    {
      title: "Theme Presets",
      items: [
        { 
          label: "OS Style Presets", 
          key: "presets", 
          type: "presets", 
          options: ["Omarchy", "Sketchy", "Minimal", "Cyber"], 
          icon: faDesktop, 
          desc: "Quickly switch between pre-configured OS styles" 
        },
      ]
    },
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
    },
    {
      title: "Global Styles",
      items: [
        { label: "Background Theme", key: "bgTheme", type: "theme-picker", options: ["theme-none", "theme-dots", "theme-grid", "theme-paper", "theme-blueprint", "theme-cross", "theme-waves", "theme-notebook"], value: globalBgTheme, icon: faImage, desc: "Change generic background pattern" },
        { label: "Apply Background", key: "bgScope", type: "select", options: ["all", "base"], value: globalBgScope, icon: faEye, desc: "Apply to all wrappers or base body only" },
        { label: "Border Color", key: "borderColor", type: "color", value: globalBorderColor, icon: faFillDrip, desc: "Change color of all borders" },
        { label: "Border Style", key: "borderStyle", type: "select", options: ["solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset", "none"], value: globalBorderStyle, icon: faMagic, desc: "Change style of all borders" },
        { label: "Border Width", key: "borderWidth", type: "select", options: ["1px", "2px", "3px", "4px", "5px", "6px", "8px"], value: globalBorderWidth, icon: faFeatherPointed, desc: "Change thickness of all borders" },
        { label: "Border Radius", key: "borderRadius", type: "select", options: ["0px", "4px", "8px", "12px", "16px", "24px", "50%"], value: globalBorderRadius, icon: faMagic, desc: "Change corner rounding of all components" },
        { label: "Shadow Direction (X)", key: "shadowX", type: "select", options: ["-10px", "-8px", "-6px", "-4px", "-2px", "0px", "2px", "4px", "6px", "8px", "10px"], value: globalShadowX, icon: faBullseye, desc: "Horizontal offset of shadows" },
        { label: "Shadow Direction (Y)", key: "shadowY", type: "select", options: ["-10px", "-8px", "-6px", "-4px", "-2px", "0px", "2px", "4px", "6px", "8px", "10px"], value: globalShadowY, icon: faBullseye, desc: "Vertical offset of shadows" },
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
                  <div key={item.key} className={`setting-item-card ${(item.value === true) ? 'active' : ''}`}>
                    <div className="item-icon">
                      <FontAwesomeIcon icon={item.icon} />
                    </div>
                    <div className="item-info">
                      <span className="item-label">{item.label}</span>
                      <span className="item-desc">{item.desc}</span>
                    </div>
                    <div className="item-action">
                      {item.type === 'color' ? (
                        <input
                          type="color"
                          value={item.value}
                          onChange={(e) => handleStyleChange(item.key, e.target.value)}
                          style={{ width: '50px', height: '30px', cursor: 'pointer', border: 'none', padding: 0 }}
                        />
                      ) : item.type === 'select' ? (
                        <select
                          value={item.value}
                          onChange={(e) => handleStyleChange(item.key, e.target.value)}
                          style={{ padding: '5px', borderRadius: '5px', border: '1px solid #111827', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
                        >
                          {item.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : item.type === 'theme-picker' ? (
                        <div className="theme-picker-container">
                          {item.options.map(theme => (
                            <Tooltip key={theme} placement="top" title={theme.replace('theme-', '')}>
                              <div
                                className={`theme-preview-box ${theme} ${item.value === theme ? 'selected' : ''}`}
                                onClick={() => handleStyleChange(item.key, theme)}
                              ></div>
                            </Tooltip>
                          ))}
                        </div>
                      ) : item.type === 'presets' ? (
                        <div className="preset-container" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {item.options.map(opt => (
                            <button
                              key={opt}
                              onClick={() => applyPreset(opt)}
                              style={{
                                padding: '6px 12px',
                                border: '2px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--container-bg)',
                                color: 'var(--text-color)',
                                fontWeight: '800',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                              }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Switch
                          checked={item.value}
                          onChange={(checked) => handleSwitchChange(item.key, checked)}
                        />
                      )}
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
