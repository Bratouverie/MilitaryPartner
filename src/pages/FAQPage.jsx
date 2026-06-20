import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import FAQSection from "@/components/landing/FAQSection";
import { Shield } from "lucide-react";

export default function FAQPage() {
  return (
    <div className="min-h-screen">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
          </Link>
          <Link to="/login"><Button variant="outline" size="sm" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">Вход</Button></Link>
        </div>
      </header>
      <FAQSection />
      <Footer />
    </div>
  );
}