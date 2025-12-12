"use client";

import React, { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

type PDFInnerProps = {
  onSelection: (text: string) => void;
  onClearSelection: () => void;
  onFileLoaded?: (fileName: string) => void;
};

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDFInner: React.FC<PDFInnerProps> = ({
  onSelection,
  onClearSelection,
  onFileLoaded,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(
    null
  );

  // 清理 objectURL
  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    setFileObj(file);
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setHighlightRect(null);
    onClearSelection();
    onFileLoaded?.(file.name);
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error:", error);
  };

  // 鼠标抬起时记录高亮
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    const top = rect.top - containerRect.top + container.scrollTop;
    const left = rect.left - containerRect.left + container.scrollLeft;

    setHighlightRect({
      top,
      left,
      width: rect.width,
      height: rect.height,
    });

    onSelection(text);
  };

  // 点击空白处取消当前高亮 + 右侧 Q&A
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!containerRef.current) return;

    // 只在点击容器空白区域时清空（而不是点击文字）
    if (target === containerRef.current) {
      setHighlightRect(null);
      onClearSelection();
      const sel = window.getSelection();
      sel?.removeAllRanges();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Upload button */}
      <div style={{ marginBottom: "8px" }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "9999px",
            border: "1px solid #d1d5db",
            backgroundColor: "#f9fafb",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          <span>Upload PDF</span>
          <input
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </label>
        {fileObj && (
          <span
            style={{
              marginLeft: "8px",
              fontSize: "12px",
              color: "#6b7280",
            }}
          >
            {fileObj.name}
          </span>
        )}
      </div>

      {/* PDF display + highlight overlay */}
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        onMouseDown={handleMouseDown}
        style={{
          position: "relative",
          flex: 1,
          overflow: "auto",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
        }}
      >
        {fileUrl ? (
          <>
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    color: "#9ca3af",
                  }}
                >
                  Loading PDF…
                </div>
              }
            >
              {Array.from({ length: numPages }).map((_, index) => (
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  width={700}
                  renderAnnotationLayer={false}
                  renderTextLayer
                />
              ))}
            </Document>

            {/* 黄色高亮覆盖层 */}
            {highlightRect && (
              <div
                style={{
                  pointerEvents: "none",
                  position: "absolute",
                  top: highlightRect.top,
                  left: highlightRect.left,
                  width: highlightRect.width,
                  height: highlightRect.height,
                  backgroundColor: "rgba(255, 255, 0, 0.4)",
                  borderRadius: "4px",
                }}
              />
            )}
          </>
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13px",
              color: "#9ca3af",
            }}
          >
            Please upload a PDF file and drag to highlight text.
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFInner;
