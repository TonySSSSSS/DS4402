import "./globals.css";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Insurance Form Helper",
  description: "PDF highlighting + chat explanation for health insurance forms",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
