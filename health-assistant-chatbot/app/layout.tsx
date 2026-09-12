import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wellpoint — Health Assistant",
  description: "A grounded, source-backed health information assistant.",
};

export default function RootLayout({
  children, 
}: {
  children: ReactNode; 
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
} 