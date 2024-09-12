import { useEffect } from "react";

const useLocalStorage = (key, editor) => {
  useEffect(() => {
    if (editor) {
      const savedContent = localStorage.getItem(key);
      if (savedContent) {
        editor.commands.setContent(savedContent);
      }

      const handleSave = () => {
        const content = editor.getHTML();
        localStorage.setItem(key, content);
      };

      editor.on("update", handleSave);

      return () => {
        editor.off("update", handleSave);
      };
    }
  }, [editor, key]);
};

export default useLocalStorage;
