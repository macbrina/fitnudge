"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Link2,
  ImagePlus,
  Code,
  type LucideIcon,
} from "lucide-react";
import { blogApi } from "@/lib/api";

type BlogEditorProps = {
  content: string;
  onChange: (html: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  className?: string;
};

const HEADING_LEVELS: { level: 1 | 2 | 3; icon: LucideIcon; label: string }[] = [
  { level: 1, icon: Heading1, label: "H1" },
  { level: 2, icon: Heading2, label: "H2" },
  { level: 3, icon: Heading3, label: "H3" },
];

function Toolbar({
  editor,
  htmlMode,
  onToggleHtmlMode,
}: {
  editor: Editor | null;
  htmlMode: boolean;
  onToggleHtmlMode: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopupOpen, setLinkPopupOpen] = useState(false);
  const linkPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!linkPopupOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (linkPopupRef.current && !linkPopupRef.current.contains(e.target as Node)) {
        const btn = (e.target as HTMLElement).closest("button[title='Link']");
        if (!btn) setLinkPopupOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [linkPopupOpen]);

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = linkUrl.trim() || previousUrl;
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
    setLinkUrl("");
    setLinkPopupOpen(false);
  }, [editor, linkUrl]);

  const unsetLink = useCallback(() => {
    editor?.chain().focus().unsetLink().run();
    setLinkPopupOpen(false);
  }, [editor]);

  if (!editor) return null;

  const currentLink = editor.getAttributes("link").href;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const { data, error } = await blogApi.uploadImage(file);
          if (error || !data?.url) return;
          editor.chain().focus().setImage({ src: data.url }).run();
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive("bold") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive("italic") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </button>
      {HEADING_LEVELS.map(({ level, icon: Icon, label }) => (
        <button
          key={level}
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive("heading", { level }) ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-medium ${editor.isActive("paragraph") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
        title="Paragraph"
      >
        P
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive("blockquote") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
        title="Blockquote"
      >
        <Quote className="h-4 w-4" />
      </button>
      <div className="relative inline-block" ref={linkPopupRef}>
        <button
          type="button"
          onClick={() => {
            setLinkUrl(currentLink || "");
            setLinkPopupOpen((o) => !o);
          }}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive("link") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          title="Link"
        >
          <Link2 className="h-4 w-4" />
        </button>
        {linkPopupOpen && (
          <div className="absolute left-0 top-full mt-1 z-10 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg min-w-[240px]">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm mb-2"
              onKeyDown={(e) => e.key === "Enter" && setLink()}
              autoFocus
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={setLink}
                className="px-2 py-1 text-sm rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                Apply
              </button>
              {editor.isActive("link") && (
                <button
                  type="button"
                  onClick={unsetLink}
                  className="px-2 py-1 text-sm rounded border border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onClick={() => setLinkPopupOpen(false)}
                className="px-2 py-1 text-sm rounded border"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive("bulletList") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
        title="Bullet list"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive("orderedList") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
        title="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleImageUpload}
        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        title="Insert image"
      >
        <ImagePlus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleHtmlMode}
        className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${htmlMode ? "bg-gray-200 dark:bg-gray-700" : ""}`}
        title="HTML source"
      >
        <Code className="h-4 w-4" />
      </button>
    </div>
  );
}

export function BlogEditor({ content, onChange, className }: BlogEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlSource, setHtmlSource] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        HTMLAttributes: { class: "max-w-full h-auto rounded-lg" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[200px] p-4 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync content prop to editor when it changes (e.g. post loads asynchronously in edit mode)
  useEffect(() => {
    if (editor && content !== undefined && content !== editor.getHTML()) {
      editor.commands.setContent(content || "<p></p>", false);
      if (htmlMode) setHtmlSource(content || "");
    }
  }, [content, editor, htmlMode]);

  const handleToggleHtmlMode = () => {
    if (htmlMode) {
      // Switching back to visual: apply HTML from textarea to editor
      const html = htmlSource.trim() || "<p></p>";
      editor?.commands.setContent(html);
      onChange(html);
    } else {
      // Switching to HTML: capture current content
      setHtmlSource(editor?.getHTML() ?? "");
    }
    setHtmlMode((m) => !m);
  };

  const handleHtmlSourceChange = (value: string) => {
    setHtmlSource(value);
    onChange(value.trim() || "<p></p>");
  };

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className ?? ""}`}>
      <Toolbar editor={editor} htmlMode={htmlMode} onToggleHtmlMode={handleToggleHtmlMode} />
      {htmlMode ? (
        <textarea
          value={htmlSource}
          onChange={(e) => handleHtmlSourceChange(e.target.value)}
          className="w-full min-h-[200px] p-4 font-mono text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border-0 focus:outline-none focus:ring-0 resize-y"
          placeholder="Paste or edit HTML..."
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
