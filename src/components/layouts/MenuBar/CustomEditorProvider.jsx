import { useEffect, useState } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import ListItem from "@tiptap/extension-list-item";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import MenuBar from "./MenuBar";
import Dropcursor from "@tiptap/extension-dropcursor";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import OrderedList from "@tiptap/extension-ordered-list";
import CodeBlockComponent from "../../ui/codeBlock/CodeBlockComponent";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import axiosInstance from "../../../axiosConfig";
import PropTypes from "prop-types";

const lowlight = createLowlight(common);

const extensions = [
  CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockComponent);
    },
  }).configure({ lowlight }),
  Highlight.configure({
    multicolor: true,
  }),
  OrderedList,
  Image.configure({ allowBase64: true }),
  Dropcursor,
  Underline,
  Color.configure({ types: [TextStyle.name, ListItem.name] }),
  TextStyle.configure({ types: [ListItem.name] }),
  StarterKit.configure({
    bulletList: { keepMarks: true, keepAttributes: false },
    orderedList: { keepMarks: true, keepAttributes: false },
  }),
  Placeholder.configure({ placeholder: "Write something …" }),
];

const CustomEditorProvider = ({ pageId }) => {
  const [content, setContent] = useState("");
  console.log(content);
  const editor = useEditor({
    extensions,
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/);
      const paragraph = content.match(/<p[^>]*>(.*?)<\/p>/);
      const title = titleMatch ? titleMatch[1] : "";
      const finalTitle = title || (paragraph ? paragraph[1] : "");

      (async () => {
        try {
          await axiosInstance.put(`/api/Page/${pageId}`, {
            content,
            title: finalTitle,
          });
        } catch (error) {
          console.error("Failed to save content to API", error);
        }
      })();
    },
  });

  useEffect(() => {
    if (editor && pageId) {
      (async () => {
        await fetchAndSetContent();
      })();
    }
  }, [editor, pageId]);

  const fetchAndSetContent = async () => {
    try {
      const response = await axiosInstance.get(`/api/Page/${pageId}`);
      const fetchedContent = response.data?.content || "<h1>Title here</h1>";
      setContent(fetchedContent);
      if (editor) {
        editor.commands.setContent(fetchedContent);
      }
    } catch (error) {
      console.error("Failed to fetch content from API", error);
      setContent("<h1>Title here</h1>");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        width: "80vw",
        maxWidth: "800px",
        marginBottom: "100px",
      }}
    >
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

CustomEditorProvider.propTypes = {
  pageId: PropTypes.string.isRequired,
};

export default CustomEditorProvider;
