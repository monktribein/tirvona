import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "../components/layout/Navbar";

export const metadata: Metadata = {
  title: "Tirvona Pandit & Provider Portal",
  description: "Tirvona Pandit, Purohit & Acharya Provider Management",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/logo.png", type: "image/png" }
    ],
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#F8FAFC] dark:bg-[#070F1B] text-[#0B192C] dark:text-white antialiased font-sans min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
