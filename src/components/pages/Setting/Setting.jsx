import { Switch } from "antd";
import "./Setting.scss";
import { useState, useEffect } from "react";
const Setting = () => {
  const [bubble, setBubble] = useState(
    localStorage.getItem("isBubbleMenuVisible") === "true"
  );
  const [controls, setControls] = useState(
    localStorage.getItem("isControlsMenuVisible") === "true"
  );
  const [force, setForce] = useState(
    localStorage.getItem("forceDelete") === "true"
  );
  const [eyeProtection, setEyeProtection] = useState(
    localStorage.getItem("eyeProtection") === "true"
  );

  useEffect(() => {
    const navbar = document.querySelector('.navbar');
    if (eyeProtection) {
      document.body.classList.add("eye-protection-mode");
      document.body.style.backgroundColor = "rgb(252, 255, 210)";
      if (navbar) {
        navbar.classList.add("nav-eye-protection");
      }
    } else {
      document.body.classList.remove("eye-protection-mode");
      document.body.style.backgroundColor = "white";

      if (navbar) {
        navbar.classList.remove("nav-eye-protection");
      }
    }
  }, [eyeProtection]);

  const handleSwitchChange = (key, value) => {
    if (key === "bubble") {
      setBubble(value);
      localStorage.setItem("isBubbleMenuVisible", value);
    } else if (key === "controls") {
      setControls(value);
      localStorage.setItem("isControlsMenuVisible", value);
    } else if (key === "force") {
      setForce(value);
      localStorage.setItem("forceDelete", value);
    } else if (key === "eyeProtection") {
      setEyeProtection(value);
      localStorage.setItem("eyeProtection", value);
    }
  };
  const settings = [
    { label: "Menu bubble", key: "bubble", value: bubble },
    { label: "Menu controls", key: "controls", value: controls },
    { label: "Force", key: "force", value: force },
    { label: "Eye Protection Mode", key: "eyeProtection", value: eyeProtection },
  ];
  return (
    <div className="page-container-setting">
      <div className="page-setting flex flex-col items-center justify-center space-y-4">
        {settings.map(({ label, key, value }) => (
          <div key={key} className="flex w-full">
            <span className="ml-10 text-xl font-bold flex-grow">{label}</span>
            <Switch
              className="mr-10"
              checked={value}
              onChange={(checked) => handleSwitchChange(key, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
export default Setting;
