import { useEffect } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color } from "@tiptap/extension-color";
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

const lowlight = createLowlight(common);

const extensions = [
  CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockComponent);
    },
  }).configure({ lowlight }),
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

const initialContent = `
<h2>Hi there,</h2>
<p>
  this is a <em>basic</em> example of <strong>Tiptap</strong>. Sure, there are all kinds of basic text styles you’d probably expect from a text editor. But wait until you see the lists:
</p>
<ul>
  <li>That’s a bullet list with one …</li>
  <li>… or two list items.</li>
</ul>
<p>
  Isn’t that great? And all of that is editable. But wait, there’s more. Let’s try a code block:
</p>
<pre><code class="language-css">body {
  display: none;
}</code></pre>
<p>
  I know, I know, this is impressive. It’s only the tip of the iceberg though. Give it a try and click a little bit around. Don’t forget to check the other examples too.
</p>
<blockquote>
  Wow, that’s amazing. Good work, boy! 👏<br />
  — Mom
</blockquote>
<div data-type="draggableItem">
  <p>Draggable item content</p>
</div>
`;

const CustomEditorProvider = () => {
  const editor = useEditor({
    extensions,
    content: localStorage.getItem("editorContent") || initialContent,
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/);
      const paragraph = content.match(/<p[^>]*>(.*?)<\/p>/);
      const title = titleMatch ? titleMatch[1] : "";
      const finalTitle = title || (paragraph ? paragraph[1] : "");
      try {
        localStorage.setItem("editorContent", content);
        localStorage.setItem("title", finalTitle);
      } catch (error) {
        console.error("Failed to save content to localStorage", error);
      }
    },
  });

  useEffect(() => {
    if (editor) {
      if (editor.isEmpty) {
        editor.commands.focus();
        editor.commands.setContent("<h1>Title here</h1>");
      }
    }
  }, [editor]);

  return (
    <div>
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default CustomEditorProvider;
