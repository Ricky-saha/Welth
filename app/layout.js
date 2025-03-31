import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ["latin"] });
export const metadata = {
  title: "Welth",
  description: "one Stop Finance Platform",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
    <html lang="en">
      <body
        className={`${inter.className}`}
      >
        {/* header */}
        <Header></Header>
        <main className="min-h-screen">{children}</main>
        <Toaster richColors />
        {/* footer */}
        <footer className ="bg-blue-50 py-12">
          <div className= "container mx-auto px-4 text-center text-gray-600">
            <p> Made by Ricky Saha</p>
          </div>
        </footer>
      </body>
    </html>
    </ClerkProvider>
  );
}
