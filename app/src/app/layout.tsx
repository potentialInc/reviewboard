import type { Metadata } from "next";
import { validateEnv } from "@/lib/env";
import { I18nProvider } from "@/lib/i18n/context";
import "./globals.css";

validateEnv();

export const metadata: Metadata = {
  title: "ReviewBoard",
  description: "Design review platform with pin-based feedback",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <I18nProvider>
          <div id="main-content">{children}</div>
        </I18nProvider>
      </body>
    </html>
  );
}
