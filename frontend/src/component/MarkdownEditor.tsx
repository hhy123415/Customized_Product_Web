// src/components/MarkdownEditor.tsx
import { useState, useRef } from "react";
import MDEditor from "@uiw/react-md-editor";
import api from "../api/axios";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  height = 400,
  placeholder = "请输入内容...",
}: MarkdownEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("请选择图片文件");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("图片不能超过 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.post("/images/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        const imageUrl = res.data.path;
        const imageMarkdown = `![${file.name}](${imageUrl})`;

        const textarea = editorRef.current?.querySelector("textarea");
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newValue =
            value.substring(0, start) + imageMarkdown + value.substring(end);
          onChange(newValue);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(
              start + imageMarkdown.length,
              start + imageMarkdown.length,
            );
          }, 0);
        } else {
          onChange(value + "\n" + imageMarkdown);
        }
      } else {
        alert("上传失败");
      }
    } catch (err) {
      console.error(err);
      alert("上传失败，请重试");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div ref={editorRef} data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(val) => onChange(val || "")}
        preview="live"
        height={height}
        visibleDragbar={false}
        textareaProps={{
          placeholder,
        }}
        commandsFilter={(cmd) => {
          const excludeNames = [
            "preview",
            "fullscreen",
            "codePreview",
            "codeEdit",
            "codeLive",
            "image",
          ];
          if (cmd.name && excludeNames.includes(cmd.name)) {
            return false;
          }
          return cmd;
        }}
        extraCommands={[
          {
            name: "image-upload",
            keyCommand: "image-upload",
            buttonProps: {
              "aria-label": "上传图片",
              disabled: isUploading,
              title: "上传图片",
            },
            icon: (
              <span style={{ fontSize: "14px" }}>
                {isUploading ? "上传中..." : "上传图片"}
              </span>
            ),
            execute: () => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = (e: Event) => {
                const target = e.target as HTMLInputElement;
                const file = target.files?.[0];
                if (file) handleImageUpload(file);
              };
              input.click();
            },
          },
        ]}
      />
    </div>
  );
}