import { useEffect, useState, type ComponentType } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  LinkSlash,
  List,
  NumberedListLeft,
  Quote,
  Redo,
  Strikethrough,
  TextSize,
  Underline,
  Undo,
} from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RichTextToolbarProps {
  editor: Editor | null;
}

type ToolbarIcon = ComponentType<{ className?: string }>;

const toolbarButtonClass = (active?: boolean) =>
  cn(
    "h-8 w-8 rounded-md p-0",
    active && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
  );

const ToolbarButton = ({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: ToolbarIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        title={label}
        disabled={disabled}
        className={toolbarButtonClass(active)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

export const RichTextToolbar = ({ editor }: RichTextToolbarProps) => {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      underline: instance.isActive("underline"),
      strike: instance.isActive("strike"),
      code: instance.isActive("code"),
      heading: instance.isActive("heading", { level: 2 }),
      bulletList: instance.isActive("bulletList"),
      orderedList: instance.isActive("orderedList"),
      blockquote: instance.isActive("blockquote"),
      link: instance.isActive("link"),
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    }),
  });

  useEffect(() => {
    if (!editor || !linkOpen) return;
    setLinkUrl((editor.getAttributes("link").href as string | undefined) || "https://");
  }, [editor, linkOpen]);

  if (!editor || !state) return null;

  const applyLink = () => {
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl || trimmedUrl === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmedUrl }).run();
    setLinkOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-border bg-muted/30 p-2">
      <ToolbarButton
        label="Bold"
        icon={Bold}
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Italic"
        icon={Italic}
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="Underline"
        icon={Underline}
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        label="Strikethrough"
        icon={Strikethrough}
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolbarButton
        label="Inline code"
        icon={Code}
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton
        label="Heading"
        icon={TextSize}
        active={state.heading}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="Bulleted list"
        icon={List}
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="Numbered list"
        icon={NumberedListLeft}
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Quote"
        icon={Quote}
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Add link"
                title="Add link"
                className={toolbarButtonClass(state.link)}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Add link</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-80 p-3">
          <div className="space-y-2">
            <p className="font-sans text-sm font-medium">Link URL</p>
            <div className="flex gap-2">
              <Input
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }
                }}
                placeholder="https://example.com"
              />
              <Button type="button" size="sm" onClick={applyLink}>
                Apply
              </Button>
            </div>
            {state.link && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setLinkOpen(false);
                }}
              >
                <LinkSlash className="h-4 w-4" />
                Remove link
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton
        label="Undo"
        icon={Undo}
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        label="Redo"
        icon={Redo}
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
};
