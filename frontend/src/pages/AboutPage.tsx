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
  Flame,
  CircleParking,
  Target,
  Compass,
  ArrowRight,
  Mail,
  Sparkles,
} from "lucide-react";

const AboutPage: React.FC = () => {
  useEffect(() => {
    const originalTitle = document.title;
    document.title =
      "About Tirvona | India's Digital Platform for Religious Destinations";

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
      "Tirvona connects pilgrims with verified ashram stays, local services, and sacred marketplaces across India's holy destinations."
    );
    updateOrCreateMeta(
      "property",
      "og:title",
      "About Tirvona | India's Digital Platform for Religious Destinations"
    );
    updateOrCreateMeta(
      "property",
      "og:description",
      "Connecting sacred destinations and empowering communities. Learn about Tirvona's vision, mission, and the team behind it."
    );
    updateOrCreateMeta("property", "og:type", "website");

    return () => {
      document.title = originalTitle;
    };
  }, []);

  const offerCards = [
    {
      title: "Destination Discovery",
      description:
        "Holy destinations, temple circuits, and travel details in one place, with the practical information pilgrims need before setting out.",
      icon: MapPin,
    },
    {
      title: "Stay Booking",
      description:
        "Reservations at verified ashrams and dharamshalas, confirmed with a 6-digit check-in code at the counter.",
      icon: Building2,
    },
    {
      title: "Services Exchange",
      description:
        "Local transport, lockers, and porters booked through the same account, from operators we have verified.",
      icon: ArrowLeftRight,
    },
    {
      title: "Aarti Booking",
      description:
        "Reserve a place at temple aarti in advance, and follow live pooja streams when you cannot be there in person.",
      icon: Flame,
    },
    {
      title: "Parking",
      description:
        "Reserved parking near the ghats and temple gates, held for your arrival slot instead of circling for a space.",
      icon: CircleParking,
    },
    {
      title: "Marketplace",
      description:
        "Puja essentials, religious texts, and regional handicrafts sourced directly from vendors and temple trusts.",
      icon: ShoppingBag,
    },
    {
      title: "Seva & Volunteering",
      description:
        "Volunteer registration and seva coordination, so trusts can organise on-site help without paper rosters.",
      icon: HeartHandshake,
    },
    {
      title: "Events & Darshan",
      description:
        "Festival schedules, live darshan timings, and crowd alerts for major gatherings.",
      icon: Calendar,
    },
    {
      title: "Donations",
      description:
        "Direct, traceable donation channels for verified temple trusts and annakshetra feeding programmes.",
      icon: HandHeart,
    },
  ];

  const whyTirvonaPoints = [
    {
      title: "Verified institutions",
      description:
        "Every trust, ashram, and dharamshala is checked before it goes live on the platform.",
    },
    {
      title: "Built for pilgrims",
      description:
        "Simple navigation and clear guidance, designed for travellers of every age and comfort with technology.",
    },
    {
      title: "Transparent pricing",
      description:
        "The rate you see is the rate at the counter. No hidden fees, no surprises on arrival.",
    },
    {
      title: "Tools for trusts",
      description:
        "Counter software that replaces paper registers and gives operators a live view of their rooms.",
    },
    {
      title: "Local livelihoods",
      description:
        "Drivers, guides, and artisans around each destination earn directly through the platform.",
    },
    {
      title: "Secure by default",
      description:
        "Encrypted data and compliant payment integrations on every transaction.",
    },
    {
      title: "Ready for peak days",
      description:
        "Infrastructure sized for the traffic surges of melas and festival seasons.",
    },
    {
      title: "Paperless operations",
      description:
        "Digital counters cut waste and keep records intact for the long term.",
    },
  ];

  const SectionHeading: React.FC<{
    title: string;
    id?: string;
  }> = ({ title, id }) => (
    <div className="text-center max-w-3xl mx-auto">
      <h2
        id={id}
        className="font-['Kalam'] text-2xl sm:text-4xl font-bold text-[#E58C28]"
      >
        {title}
      </h2>
      <div className="flex items-center justify-center gap-2.5 mt-1.5">
        <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
        <Sparkles size={14} className="text-[#E58C28] fill-[#E58C28] shrink-0" />
        <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
      </div>
    </div>
  );

  return (
    <div className="pb-16">
      <section className="relative isolate overflow-hidden bg-[#0B192C] text-white px-4 sm:px-6">
        <img
          src="/aboutus.png"
          alt=""
          aria-hidden="true"
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover object-[68%_center] sm:object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#0B192C]/70 via-[#0B192C]/55 to-[#0B192C]/85"
        />

        <div className="relative max-w-3xl mx-auto text-center space-y-4 pt-28 pb-20 sm:pt-36 sm:pb-28 lg:pt-44 lg:pb-36">
          <h1
            className="font-extrabold text-white leading-tight drop-shadow-lg"
            style={{ fontSize: "clamp(1.8rem, 6vw, 3rem)" }}
          >
            About <span className="text-[#E58C28]">Tirvona</span>
          </h1>

          <p className="text-sm sm:text-base text-gray-200 leading-relaxed max-w-xl mx-auto drop-shadow-md">
            Tirvona is a digital platform for sacred travel, stay management, and
            local commerce across India's holy destinations, connecting pilgrims,
            ashrams, and the communities around them.
          </p>

          <div className="pt-3 flex flex-wrap justify-center items-center gap-3">
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all"
            >
              Explore Tirvona <ArrowRight size={14} />
            </Link>

            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/25 hover:bg-white/10 text-white text-xs font-extrabold transition-all"
            >
              <Mail size={14} className="text-[#E58C28]" />
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-14 sm:space-y-20">
        <section aria-labelledby="about-tirvona-heading" className="space-y-6">
          <SectionHeading
            id="about-tirvona-heading"
            title="Who We Are"
          />

          <div className="max-w-3xl mx-auto space-y-4 text-sm sm:text-base leading-relaxed text-[#0B192C]/80 dark:text-gray-300">
            <p>
              Tirvona is a unified platform built for holy destinations, ashrams,
              temple trusts, and the people who travel to them. It replaces paper
              registers and unverified stay counters with digital tools, so a
              pilgrim knows what they are booking and a trust knows who has
              arrived.
            </p>
            <p>
              Stay reservations, local services, the marketplace, seva
              volunteering, and donations all run through one account. From
              Rishikesh and Haridwar to Varanasi and Vrindavan, we bring everyday
              technology to holy destinations without changing what makes them
              sacred.
            </p>
          </div>
        </section>

        <section
          aria-label="Vision and Mission"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <article className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0A4DA6]/10 dark:bg-white/5 flex items-center justify-center text-[#0A4DA6] dark:text-[#E58C28]">
              <Target size={20} />
            </div>
            <h2 className="text-lg font-extrabold text-[#0B192C] dark:text-white">
              Our Vision
            </h2>
            <p className="text-sm text-[#0B192C]/70 dark:text-gray-300 leading-relaxed">
              A connected ecosystem across India's sacred destinations, where
              every pilgrim travels safely and easily, and the trusts and
              communities that host them can thrive alongside.
            </p>
          </article>

          <article className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0A4DA6]/10 dark:bg-white/5 flex items-center justify-center text-[#0A4DA6] dark:text-[#E58C28]">
              <Compass size={20} />
            </div>
            <h2 className="text-lg font-extrabold text-[#0B192C] dark:text-white">
              Our Mission
            </h2>
            <p className="text-sm text-[#0B192C]/70 dark:text-gray-300 leading-relaxed">
              To simplify stay bookings, digitise counter operations, connect
              local service providers, and keep money flowing transparently to
              the trusts and communities it belongs to.
            </p>
          </article>
        </section>

        <section aria-labelledby="what-we-offer-heading" className="space-y-8">
          <SectionHeading
            id="what-we-offer-heading"
            title="What We Do"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {offerCards.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-3"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#0A4DA6]/10 dark:bg-slate-800 flex items-center justify-center text-[#0A4DA6] dark:text-[#E58C28]">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#0B192C]/70 dark:text-gray-300 leading-relaxed">
                    {card.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="why-tirvona-heading" className="space-y-8">
          <SectionHeading
            id="why-tirvona-heading"
            title="Why Tirvona"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 max-w-6xl mx-auto">
            {whyTirvonaPoints.map((point) => (
              <div
                key={point.title}
                className="border-l-2 border-[#E58C28] pl-4 space-y-1.5"
              >
                <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                  {point.title}
                </h3>
                <p className="text-xs text-[#0B192C]/70 dark:text-gray-300 leading-relaxed">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="our-commitment-heading" className="space-y-6">
          <SectionHeading
            id="our-commitment-heading"
            title="Our Commitment"
          />

          <div className="max-w-3xl mx-auto space-y-4 text-sm sm:text-base leading-relaxed text-[#0B192C]/80 dark:text-gray-300">
            <p>
              We keep pilgrim data private, we keep trust finances transparent,
              and we keep access to holy stays uncommercialised. We work with
              state tourism departments where it helps, and we do not list
              anything on this platform that we have not verified ourselves.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="bizwoke-nova-heading"
          className="max-w-3xl mx-auto text-center space-y-3"
        >
          <h2
            id="bizwoke-nova-heading"
            className="text-lg sm:text-xl font-extrabold text-[#0B192C] dark:text-white"
          >
            Built by Bizwoke Nova (NKtech)
          </h2>
          <p className="text-sm text-[#0B192C]/70 dark:text-gray-300 leading-relaxed">
            Tirvona is designed, engineered, and operated by Bizwoke Nova
            (NKtech), a technology firm working on marketplace platforms and
            public digital services.
          </p>
        </section>

        <section
          aria-labelledby="join-transformation-heading"
          className="text-center space-y-4 max-w-2xl mx-auto"
        >
          <h2
            id="join-transformation-heading"
            className="text-xl sm:text-3xl font-extrabold text-[#0B192C] dark:text-white leading-tight"
          >
            Partner With Us
          </h2>

          <p className="text-sm text-[#0B192C]/70 dark:text-gray-300 leading-relaxed">
            Ashram trust, dharamshala, local service provider, or tourism body:
            if you serve pilgrims, there is a place for you here.
          </p>

          <div className="pt-2 flex flex-wrap justify-center items-center gap-3">
            <Link
              to="/partner"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all"
            >
              Become a Partner <ArrowRight size={14} />
            </Link>

            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#0B192C]/15 dark:border-white/20 hover:bg-[#0B192C]/5 dark:hover:bg-white/10 text-[#0B192C] dark:text-white text-xs font-extrabold transition-all"
            >
              <Mail size={14} className="text-[#E58C28]" />
              Contact Tirvona
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AboutPage;
