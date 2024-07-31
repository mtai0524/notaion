import { useEffect } from "react";

const useLocalStorage = (key, editor) => {
  useEffect(() => {
    if (editor) {
      // Tải nội dung từ localStorage khi editor được khởi tạo
      const savedContent = localStorage.getItem(key);
      if (savedContent) {
        editor.commands.setContent(savedContent);
      }

      // Lưu nội dung vào localStorage khi có sự thay đổi
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
