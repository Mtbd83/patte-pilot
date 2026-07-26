import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";


export const metadata: Metadata = {
  title: "Anim Management",
  description: "Created by Maud Tribaudeau",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
      >
        {children}
        <Toaster
          position="top-center"
          expand={true}
          richColors
          toastOptions={{
            style: {
              padding: '16px',
              fontSize: '16px',
              minWidth: '400px',
            },
            classNames: {
              error: 'text-base',
              success: 'text-base',
            },
          }}
        />
      </body>
    </html>
  );
}
