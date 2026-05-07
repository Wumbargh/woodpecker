import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taktik-Drill",
  description: "Schach-Taktiktraining nach der Woodpecker-Methode",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
