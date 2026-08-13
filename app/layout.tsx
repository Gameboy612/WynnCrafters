import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wynncrafters",
  description:
    "A static Wynncraft recipe finder that uses the Wynncraft API from the browser."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
