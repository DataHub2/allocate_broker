import type { Metadata } from "next";
import { Big_Shoulders, Big_Shoulders_Stencil, Caveat, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const display = Big_Shoulders({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display" });
const stencil = Big_Shoulders_Stencil({ subsets: ["latin"], weight: ["800"], variable: "--font-stencil" });
const hand = Caveat({ subsets: ["latin"], weight: ["600"], variable: "--font-hand" });
const body = Source_Serif_4({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Allocate",
  description: "Beskriv jobbet hemma och få offerter från högst tre bygg-, el- och VVS-företag per yrke.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv" className={`${display.variable} ${stencil.variable} ${body.variable} ${hand.variable}`}>
      <body>
        <a className="skip" href="#innehall">Hoppa till innehåll</a>
        {children}
      </body>
    </html>
  );
}
