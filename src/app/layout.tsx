import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Moto Loop Planner",
  description:
    "Generate optimized motorcycle loop routes from open data, score them for fun, save, share & export to GPS.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthProvider>
          <Navbar />
          <main className="overflow-x-hidden">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
