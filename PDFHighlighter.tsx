"use client";

import React from "react";
import dynamic from "next/dynamic";

type PDFHighlighterProps = {
  onSelection: (text: string) => void;
  onClearSelection: () => void;
  onFileLoaded?: (fileName: string) => void;
};

const PDFInner = dynamic(() => import("./PDFInner"), {
  ssr: false,
  loading: () => (
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
      Loading PDF viewer…
    </div>
  ),
});

const PDFHighlighter: React.FC<PDFHighlighterProps> = (props) => {
  return <PDFInner {...props} />;
};

export default PDFHighlighter;
