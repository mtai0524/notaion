import { Switch } from "antd";
import "./Setting.scss";
import { useState } from "react";

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
    }
  };

  const settings = [
    { label: "Menu bubble", key: "bubble", value: bubble },
    { label: "Menu controls", key: "controls", value: controls },
    { label: "Force", key: "force", value: force },
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
