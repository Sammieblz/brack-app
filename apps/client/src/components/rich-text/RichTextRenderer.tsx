import { isSafeRichTextUrl, sanitizeRichTextHtml } from "@/lib/richText";
import { sanitizeText } from "@/utils/sanitize";
import { cn } from "@/lib/utils";
import type { RichTextDocument, RichTextFormat } from "@/types/richText";
import type { ReactNode } from "react";

interface RichTextRendererProps {
  content?: string | null;
  contentFormat?: RichTextFormat | string | null;
  contentJson?: RichTextDocument | null;
  contentHtml?: string | null;
  className?: string;
}

const renderMarks = (
  children: ReactNode,
  marks: Array<Record<string, unknown>> | undefined,
  keyPrefix: string
): ReactNode => {
  if (!marks?.length) return children;

  return marks.reduce<ReactNode>((node, mark, index) => {
    const key = `${keyPrefix}-mark-${index}`;
    switch (mark.type) {
      case "bold":
        return <strong key={key}>{node}</strong>;
      case "italic":
        return <em key={key}>{node}</em>;
      case "underline":
        return <u key={key}>{node}</u>;
      case "strike":
        return <s key={key}>{node}</s>;
      case "code":
        return <code key={key}>{node}</code>;
      case "link": {
        const attrs = mark.attrs as Record<string, unknown> | undefined;
        const href = attrs?.href;
        if (!isSafeRichTextUrl(href)) return node;
        return (
          <a key={key} href={href} target="_blank" rel="noreferrer">
            {node}
          </a>
        );
      }
      default:
        return node;
    }
  }, children);
};

const renderNode = (node: Record<string, unknown>, key: string): ReactNode => {
  const children = Array.isArray(node.content)
    ? node.content.map((child, index) =>
        child && typeof child === "object" && !Array.isArray(child)
          ? renderNode(child as Record<string, unknown>, `${key}-${index}`)
          : null
      )
    : null;

  if (node.type === "text") {
    return renderMarks(
      typeof node.text === "string" ? node.text : "",
      Array.isArray(node.marks) ? (node.marks as Array<Record<string, unknown>>) : undefined,
      key
    );
  }

  if (node.type === "hardBreak") return <br key={key} />;

  if (node.type === "mention") {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    const label = typeof attrs?.label === "string" ? attrs.label : "reader";
    return (
      <span key={key} data-mention className="rounded bg-primary/10 px-1 font-medium text-primary">
        @{label}
      </span>
    );
  }

  switch (node.type) {
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "heading": {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      const level = attrs?.level === 1 || attrs?.level === 3 ? attrs.level : 2;
      if (level === 1) return <h1 key={key}>{children}</h1>;
      if (level === 3) return <h3 key={key}>{children}</h3>;
      return <h2 key={key}>{children}</h2>;
    }
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return <ol key={key}>{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    default:
      return <span key={key}>{children}</span>;
  }
};

export const RichTextRenderer = ({
  content,
  contentFormat,
  contentJson,
  contentHtml,
  className,
}: RichTextRendererProps) => {
  const proseClassName = cn("prose prose-sm max-w-none dark:prose-invert", className);

  if (contentFormat === "tiptap" && contentHtml) {
    return (
      <div
        className={proseClassName}
        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(contentHtml) }}
      />
    );
  }

  if (contentFormat === "tiptap" && contentJson?.content?.length) {
    return (
      <div className={proseClassName}>
        {contentJson.content.map((node, index) => renderNode(node, `rich-node-${index}`))}
      </div>
    );
  }

  return (
    <p className={cn("whitespace-pre-wrap break-words font-serif leading-relaxed", className)}>
      {sanitizeText(content || "")}
    </p>
  );
};
