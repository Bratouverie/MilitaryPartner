import React from "react";
import PublicHeader from "@/components/landing/PublicHeader";
import Footer from "@/components/landing/Footer";
import FAQSection from "@/components/landing/FAQSection";

export default function FAQPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <FAQSection />
      <Footer />
    </div>
  );
}