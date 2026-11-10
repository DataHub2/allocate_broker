import type { Metadata } from "next";
import { Albert_Sans, Big_Shoulders } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const display = Big_Shoulders({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const body = Albert_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Allocate",
  description: "Beskriv jobbet hemma och få offerter från högst tre bygg-, el- och VVS-företag per yrke.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv" className={`${display.variable} ${body.variable}`}>
      <body>
        <a className="skip" href="#innehall">Hoppa till innehåll</a>
        {children}
      </body>
    </html>
  );
}
