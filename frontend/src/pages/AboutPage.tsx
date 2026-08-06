import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Building2,
  ArrowLeftRight,
  ShoppingBag,
  HeartHandshake,
  Calendar,
  HandHeart,
  ShieldCheck,
  CheckCircle2,
  Target,
  Compass,
  ArrowRight,
  Mail,
  Cpu,
  Layers,
  Globe,
  Lock,
  Zap,
  BarChart3,
  Users,
  Award,
} from "lucide-react";

const AboutPage: React.FC = () => {
  useEffect(() => {
    // Dynamic SEO Metadata management
    const originalTitle = document.title;
    document.title =
      "About Tirvona™ | India's Digital Infrastructure for Religious Destinations";

    const updateOrCreateMeta = (
      attrName: string,
      attrVal: string,
      contentVal: string
    ) => {
      let element = document.querySelector(
        `meta[${attrName}="${attrVal}"]`
      ) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attrName, attrVal);
        document.head.appendChild(element);
      }
      element.setAttribute("content", contentVal);
    };

    updateOrCreateMeta(
      "name",
      "description",
      "Tirvona™ is India's premier digital infrastructure for religious destinations. We empower pilgrims, ashrams, and local communities with verified stays, counter software, and sacred services."
    );
    updateOrCreateMeta(
      "property",
      "og:title",
      "About Tirvona™ | India's Digital Infrastructure for Religious Destinations"
    );
    updateOrCreateMeta(
      "property",
      "og:description",
      "Connecting Sacred Destinations. Empowering Communities. Learn about Tirvona's vision, mission, and enterprise architecture developed by Bizwoke Nova (NKtech)."
    );
    updateOrCreateMeta("property", "og:type", "website");

    return () => {
      document.title = originalTitle;
    };
  }, []);

  const offerCards = [
    {
      title: "Religious Destination Discovery",
      description:
        "Comprehensive digital discovery for holy destinations, temple circuits, heritage details, and travel logistics across India's sacred hubs.",
      icon: MapPin,
    },
    {
      title: "Stay Booking",
      description:
        "Seamless digital accommodation counter and reservation system for verified ashrams, dharamshalas, and spiritual stays with instant 6-digit check-in codes.",
      icon: Building2,
    },
    {
      title: "Tirvona Services Exchange™",
      description:
        "Unified service exchange engine connecting pilgrims with verified local transport, locker rentals, parking, and essential pilgrimage logistics.",
      icon: ArrowLeftRight,
    },
    {
      title: "Marketplace",
      description:
        "Authentic marketplace for certified puja essentials, religious texts, regional handicrafts, and spiritual products directly sourced from verified vendors.",
      icon: ShoppingBag,
    },
    {
      title: "Seva & Workforce",
      description:
        "Organized portal for volunteer registration, seva coordination, on-site desk management, and community service allocation.",
      icon: HeartHandshake,
    },
    {
      title: "Religious Events",
      description:
        "Real-time event schedules, festival guides, live darshan timings, and crowd awareness alerts for major spiritual gatherings.",
      icon: Calendar,
    },
    {
      title: "Donations & Community Initiatives",
      description:
        "Transparent digital donation channels directly empowering verified temple trusts, feeding programs (annakshetra), and local community infrastructure.",
      icon: HandHeart,
    },
  ];

  const whyTirvonaPoints = [
    {
      title: "Verified Religious Institutions",
      description:
        "Rigorous verification process for trusts, ashrams, and dharamshalas to guarantee authenticity, safety, and legitimacy.",
    },
    {
      title: "Pilgrim First Experience",
      description:
        "Designed with deep empathy for pilgrims of all ages, offering intuitive navigation, clear guidance, and compassionate service.",
    },
    {
      title: "Trusted Accommodation",
      description:
        "Clean, reliable, and standardized staying options with transparent pricing and zero hidden fees at counter desks.",
    },
    {
      title: "Digital Empowerment",
      description:
        "Equipping traditional trusts and local counter operators with enterprise management software and real-time operational insights.",
    },
    {
      title: "Local Communities",
      description:
        "Directly integrating local drivers, guides, artisans, and small business owners into the pilgrimage ecosystem to build local wealth.",
    },
    {
      title: "Secure Technology",
      description:
        "Enterprise-grade data protection, end-to-end encryption, and RBI-compliant secure payment integrations.",
    },
    {
      title: "Scalable Infrastructure",
      description:
        "Built on cloud-native architecture engineered to handle immense traffic surges during major melas and festival peaks.",
    },
    {
      title: "Long-term Sustainability",
      description:
        "Promoting paperless counters, eco-friendly destination management, and preserving sacred heritage for generations to come.",
    },
  ];

  const bizwokeNovaPillars = [
    { name: "Technology Partner", icon: Globe },
    { name: "Enterprise-grade Architecture", icon: Layers },
    { name: "AI Platforms", icon: Cpu },
    { name: "Government Digital Transformation", icon: ShieldCheck },
    { name: "Marketplace Solutions", icon: ShoppingBag },
    { name: "Analytics", icon: BarChart3 },
    { name: "Security", icon: Lock },
    { name: "Scalability", icon: Zap },
    { name: "Performance", icon: Award },
    { name: "User Experience", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060D17] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* ================= 1. HERO SECTION ================= */}
      <header className="bg-[#0B192C] text-white py-16 sm:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden border-b border-slate-800">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#0A4DA6]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full px-4 py-1.5">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
            Enterprise Digital Infrastructure
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            About <span className="text-[#D4AF37]">Tirvona™</span>
          </h1>

          <p className="text-lg sm:text-xl font-semibold text-slate-200 tracking-wide max-w-3xl mx-auto">
            India's Digital Infrastructure for Religious Destinations
          </p>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl mx-auto font-normal">
            Tirvona™ is a state-of-the-art digital ecosystem transforming sacred
            travel, stay management, and local commerce across India's holy
            destinations. Aligned with Digital India standards, we bridge
            centuries of spiritual tradition with enterprise-grade cloud
            technology.
          </p>

          <div className="pt-4 flex flex-wrap justify-center items-center gap-4">
            <Link
              to="/search"
              className="inline-flex items-center gap-2 bg-[#D4AF37] hover:bg-[#c29f2e] text-[#0B192C] font-bold px-6 py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-[#0B192C]"
              aria-label="Explore Tirvona destinations"
            >
              <span>Explore Tirvona</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold px-6 py-3.5 rounded-xl border border-slate-700 transition-all focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-[#0B192C]"
              aria-label="Contact Tirvona team"
            >
              <Mail className="w-4 h-4 text-[#D4AF37]" />
              <span>Contact Us</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16 sm:space-y-24">
        {/* ================= 2. ABOUT TIRVONA ================= */}
        <section aria-labelledby="about-tirvona-heading" className="space-y-6">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2
              id="about-tirvona-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B192C] dark:text-white"
            >
              About Tirvona
            </h2>
            <div className="w-16 h-1 bg-[#D4AF37] mx-auto rounded-full" />
          </div>

          <div className="bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm leading-relaxed text-slate-700 dark:text-slate-300 space-y-4 text-base sm:text-lg">
            <p>
              Tirvona™ is India's dedicated unified digital infrastructure platform
              engineered specifically for holy destinations, ashrams, temple trusts,
              and spiritual travelers. By replacing outdated paper registers and unverified
              stay counters with secure digital tools, Tirvona provides absolute transparency,
              safety, and dignity for every pilgrim.
            </p>
            <p>
              Our platform seamlessly integrates staying reservations, verified local
              services, authentic spiritual marketplaces, seva volunteer portals, and
              community donation channels into a unified enterprise interface. From
              Rishikesh and Haridwar to Varanasi and Vrindavan, Tirvona empowers holy
              destinations with world-class technology while preserving the sacred sanctity of
              Indian pilgrimage.
            </p>
          </div>
        </section>

        {/* ================= 3 & 4. VISION & MISSION ================= */}
        <section aria-label="Vision and Mission" className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Vision */}
          <article className="bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-sm hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0A4DA6]/10 dark:bg-white/5 border border-[#0A4DA6]/20 dark:border-white/10 flex items-center justify-center text-[#0A4DA6] dark:text-[#D4AF37]">
                <Target className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-[#0B192C] dark:text-white">
                Our Vision
              </h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base">
                To establish a modern, globally accessible, and digitally empowered
                ecosystem across all sacred destinations in India, ensuring every pilgrim
                experiences seamless, safe, and spiritually fulfilling journeys while
                enabling local communities and traditional trusts to thrive in the digital era.
              </p>
            </div>
          </article>

          {/* Mission */}
          <article className="bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-sm hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0A4DA6]/10 dark:bg-white/5 border border-[#0A4DA6]/20 dark:border-white/10 flex items-center justify-center text-[#0A4DA6] dark:text-[#D4AF37]">
                <Compass className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-[#0B192C] dark:text-white">
                Our Mission
              </h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base">
                To build scalable, enterprise-grade technology that simplifies stay bookings,
                digitizes trust counter operations, connects local service exchange ecosystems,
                and fosters transparent governance across religious destinations with absolute
                integrity and pilgrim-first commitment.
              </p>
            </div>
          </article>
        </section>

        {/* ================= 5. WHAT WE OFFER ================= */}
        <section aria-labelledby="what-we-offer-heading" className="space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2
              id="what-we-offer-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B192C] dark:text-white"
            >
              What We Offer
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Comprehensive enterprise solutions for religious destination management
            </p>
            <div className="w-16 h-1 bg-[#D4AF37] mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {offerCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <article
                  key={index}
                  className="bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-[#0A4DA6]/10 dark:bg-slate-800 flex items-center justify-center text-[#0A4DA6] dark:text-[#D4AF37]">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0B192C] dark:text-white">
                      {card.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ================= 6. WHY TIRVONA ================= */}
        <section aria-labelledby="why-tirvona-heading" className="space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2
              id="why-tirvona-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B192C] dark:text-white"
            >
              Why Tirvona
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Built on trust, security, and sustainability for India's sacred ecosystem
            </p>
            <div className="w-16 h-1 bg-[#D4AF37] mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyTirvonaPoints.map((point, idx) => (
              <article
                key={idx}
                className="bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:border-[#D4AF37]/40 transition-all space-y-3"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#0A4DA6] dark:text-[#D4AF37] shrink-0" />
                  <h3 className="font-bold text-base text-[#0B192C] dark:text-white">
                    {point.title}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {point.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ================= 7. OUR COMMITMENT ================= */}
        <section aria-labelledby="our-commitment-heading">
          <div className="bg-gradient-to-br from-[#0B192C] via-[#0E2440] to-[#0B192C] border border-slate-800 rounded-3xl p-8 sm:p-12 text-white shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4 max-w-4xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-[#D4AF37]">
                <ShieldCheck className="w-4 h-4" />
                Uncompromised Standards
              </div>

              <h2
                id="our-commitment-heading"
                className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white"
              >
                Our Commitment
              </h2>

              <p className="text-base sm:text-lg text-slate-200 leading-relaxed font-normal">
                At Tirvona™, we are committed to upholding the sacred ethos of Indian
                pilgrimage while bringing state-of-the-art software technology to religious
                destinations. We promise complete data privacy, transparent financial transactions
                for trusts, non-commercialized access to holy stays, and continuous collaboration
                with state tourism departments to ensure safety, dignity, and excellence for every visitor.
              </p>
            </div>
          </div>
        </section>

        {/* ================= 8. DEVELOPED & MANAGED BY BIZWOKE NOVA ================= */}
        <section
          aria-labelledby="bizwoke-nova-heading"
          className="bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 shadow-sm space-y-8"
        >
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold tracking-wider text-[#0A4DA6] dark:text-[#D4AF37] bg-[#0A4DA6]/10 dark:bg-[#D4AF37]/10 px-3.5 py-1.5 rounded-full">
              <Building2 className="w-4 h-4" />
              Enterprise Technology Leadership
            </div>

            <h2
              id="bizwoke-nova-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B192C] dark:text-white"
            >
              Developed & Managed by Bizwoke Nova (NKtech)
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Tirvona™ is conceptualized, engineered, and operated by{" "}
              <strong className="text-[#0B192C] dark:text-white font-semibold">
                Bizwoke Nova (NKtech)
              </strong>
              , a premier technology firm specializing in enterprise-grade architecture, AI platform development, government digital transformation, and large-scale marketplace engineering.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-4">
              Core Technical Capabilities & Infrastructure Architecture
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {bizwokeNovaPillars.map((pillar, idx) => {
                const PillarIcon = pillar.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold"
                  >
                    <PillarIcon className="w-4 h-4 text-[#0A4DA6] dark:text-[#D4AF37] shrink-0" />
                    <span>{pillar.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================= 9. JOIN THE DIGITAL TRANSFORMATION ================= */}
        <section
          aria-labelledby="join-transformation-heading"
          className="bg-gradient-to-r from-[#0A4DA6] to-[#0B192C] rounded-3xl p-8 sm:p-12 text-center text-white shadow-lg space-y-6 relative overflow-hidden"
        >
          <div className="max-w-3xl mx-auto space-y-4 relative z-10">
            <h2
              id="join-transformation-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight"
            >
              Join the Digital Transformation of Religious Destinations
            </h2>

            <p className="text-sm sm:text-base text-slate-200 max-w-2xl mx-auto leading-relaxed">
              Whether you represent an ashram trust, dharamshala, local service provider, or government tourism body — partner with Tirvona to shape the future of sacred travel.
            </p>

            <div className="pt-4 flex flex-wrap justify-center items-center gap-4">
              <Link
                to="/partner"
                className="inline-flex items-center gap-2 bg-[#D4AF37] hover:bg-[#c29f2e] text-[#0B192C] font-bold px-6 py-3.5 rounded-xl transition-all shadow-md focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-[#0A4DA6]"
                aria-label="Become a Tirvona partner"
              >
                <span>Become a Partner</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/contact"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3.5 rounded-xl border border-white/20 transition-all focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0A4DA6]"
                aria-label="Contact Tirvona team"
              >
                <Mail className="w-4 h-4 text-[#D4AF37]" />
                <span>Contact Tirvona</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ================= 10. FOOTER STATEMENT ================= */}
        <footer className="pt-8 pb-12 border-t border-slate-200 dark:border-slate-800 text-center space-y-3">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#0B192C] dark:text-[#D4AF37]">
            Tirvona™
          </h2>
          <p className="text-base sm:text-lg font-medium text-slate-600 dark:text-slate-300">
            Connecting Sacred Destinations. Empowering Communities.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default AboutPage;
