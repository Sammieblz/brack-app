import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import CharacterCount from "@tiptap/extension-character-count";
import { RichTextToolbar } from "./RichTextToolbar";
import { richTextToPlainText } from "@/lib/richText";
import type { RichTextDocument, RichTextPayload } from "@/types/richText";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value?: RichTextPayload | null;
  onChange: (payload: RichTextPayload) => void;
  placeholder?: string;
  limit?: number;
  className?: string;
  minHeightClassName?: string;
  id?: string;
  labelledBy?: string;
  disabled?: boolean;
}

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = "Write something thoughtful...",
  limit = 10000,
  className,
  minHeightClassName = "min-h-40",
  id,
  labelledBy,
  disabled = false,
}: RichTextEditorProps) => {
  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit }),
    ],
    content: value?.content_format === "tiptap" && value.content_json ? value.content_json : value?.content || "",
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
        role: "textbox",
        "aria-multiline": "true",
        class:
          "prose prose-sm max-w-none focus:outline-none dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-blockquote:my-2",
      },
    },
    onUpdate: ({ editor: instance }) => {
      const json = instance.getJSON() as RichTextDocument;
      const content = richTextToPlainText(json).slice(0, limit);
      onChange({
        content_format: "tiptap",
        content_json: json,
        content_html: instance.getHTML(),
        content,
      });
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          ...editor.options.editorProps.attributes,
          ...(id ? { id } : {}),
          ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
          "aria-disabled": String(disabled),
        },
      },
    });
  }, [editor, id, labelledBy, disabled]);

  useEffect(() => {
    if (!editor || !value) return;
    const current = editor.getJSON();
    if (JSON.stringify(current) === JSON.stringify(value.content_json)) return;
    if (value.content_format === "tiptap" && value.content_json) {
      editor.commands.setContent(value.content_json, { emitUpdate: false });
    } else if (editor.getText() !== (value.content || "")) {
      editor.commands.setContent(value.content || "", { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className={cn("overflow-hidden rounded-md", className)}>
      <fieldset disabled={disabled} className="min-w-0">
        <legend className="sr-only">Text formatting</legend>
        <RichTextToolbar editor={editor} />
      </fieldset>
      <div className={cn("rounded-b-md border border-t-0 border-border bg-background px-3 py-2", minHeightClassName)}>
        <EditorContent editor={editor} />
      </div>
      {editor && (
        <div className="mt-1 text-right font-sans text-xs text-muted-foreground">
          {editor.storage.characterCount.characters()} / {limit}
        </div>
      )}
    </div>
  );
};
