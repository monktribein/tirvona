import React, { useState } from "react";
import { formatCurrency } from "../utils/format";
import {
  CheckCircle,
  ArrowRight,
  Building2,
  Users,
  Star,
  ShieldCheck,
} from "lucide-react";

const plans = [
  {
    name: "Basic Listing",
    price: null,
    priceLabel: "Free",
    desc: "Perfect for small ashrams and dharamshalas just getting started.",
    features: [
      "1 Ashram listing",
      "Up to 5 room types",
      "Basic analytics dashboard",
      "Email support",
      "Verified badge after KYC",
    ],
    cta: "Get Started Free",
    highlight: false,
  },
  {
    name: "Professional",
    price: 999,
    priceLabel: null,
    desc: "For established ashrams seeking premium visibility and bookings.",
    features: [
      "Unlimited room types",
      "Priority search placement",
      "Advanced booking calendar",
      "Custom pricing & offers",
      "Dedicated account manager",
      "Real-time booking alerts",
    ],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: null,
    priceLabel: "Custom",
    desc: "For large temple trusts and multi-property retreat organisations.",
    features: [
      "Multi-property management",
      "Government data integration",
      "Custom API access",
      "Branded booking portal",
      "On-site training & setup",
      "24/7 priority support",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

const benefits = [
  {
    icon: <Users className="w-5 h-5 text-[#0A4DA6]" />,
    title: "10M+ Pilgrims",
    desc: "Access to India's largest verified spiritual traveller base.",
  },
  {
    icon: <ShieldCheck className="w-5 h-5 text-[#0A4DA6]" />,
    title: "Trust & Safety",
    desc: "Our Tirvona Verified badge builds instant credibility with guests.",
  },
  {
    icon: <Star className="w-5 h-5 text-[#0A4DA6]" />,
    title: "Premium Exposure",
    desc: "Featured placement on popular pilgrimage circuits and city pages.",
  },
  {
    icon: <Building2 className="w-5 h-5 text-[#0A4DA6]" />,
    title: "Easy Management",
    desc: "Mobile-friendly dashboard for rooms, bookings, and payments.",
  },
];

const PartnerPage: React.FC = () => {
  const [form, setForm] = useState({
    name: "",
    ashramName: "",
    location: "",
    phone: "",
    email: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="pb-20">
      <section className="bg-[#0B192C] text-white py-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#D4AF37]/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4">
          <span className="inline-block text-[10px] font-extrabold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
            For Ashram Owners
          </span>
          <h1
            className="font-extrabold leading-tight text-white"
            style={{ fontSize: "clamp(1.8rem, 6vw, 3rem)" }}
          >
            Partner With <span className="text-[#D4AF37]">Tirvona</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl mx-auto">
            List your ashram on India's most trusted spiritual accommodation
            platform and connect with millions of verified pilgrims every month.
          </p>
          <a
            href="#register-form"
            className="inline-flex items-center gap-2 min-h-[48px] px-8 py-3 bg-[#D4AF37] text-[#0B192C] font-extrabold text-sm rounded-full shadow-lg"
          >
            Register Your Ashram <ArrowRight size={15} />
          </a>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 space-y-10">
        <div className="text-center space-y-2">
          <h2
            className="font-extrabold text-[#0B192C] dark:text-white"
            style={{ fontSize: "clamp(1.3rem, 4vw, 1.875rem)" }}
          >
            Why List on Tirvona?
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 space-y-3 shadow-sm"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#0A4DA6]/5 border border-[#0A4DA6]/10 flex items-center justify-center">
                {b.icon}
              </div>
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                {b.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 dark:bg-slate-900/50 py-14 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2
              className="font-extrabold text-[#0B192C] dark:text-white"
              style={{ fontSize: "clamp(1.3rem, 4vw, 1.875rem)" }}
            >
              Partnership Plans
            </h2>
            <p className="text-sm text-gray-500">
              Start free. Scale as you grow.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`rounded-3xl p-6 space-y-5 shadow-sm relative overflow-hidden ${plan.highlight ? "bg-[#0A4DA6] text-white border-2 border-[#0A4DA6]" : "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800"}`}
              >
                {plan.highlight && (
                  <div className="absolute top-4 right-4 bg-[#D4AF37] text-[#0B192C] text-[9px] font-extrabold px-3 py-1 rounded-full tracking-wider">
                    Most Popular
                  </div>
                )}
                <div>
                  <p
                    className={`text-[10px] font-extrabold tracking-widest ${plan.highlight ? "text-blue-200" : "text-[#D4AF37]"}`}
                  >
                    {plan.name}
                  </p>
                  <p
                    className={`text-2xl font-black mt-1 ${plan.highlight ? "text-white" : "text-[#0B192C] dark:text-white"}`}
                  >
                    {plan.price === null
                      ? plan.priceLabel
                      : `${formatCurrency(plan.price)}/mo`}
                  </p>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${plan.highlight ? "text-blue-100" : "text-gray-500"}`}
                  >
                    {plan.desc}
                  </p>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((f, j) => (
                    <li
                      key={j}
                      className={`flex items-start gap-2 text-xs ${plan.highlight ? "text-blue-50" : "text-gray-600 dark:text-gray-300"}`}
                    >
                      <CheckCircle
                        size={13}
                        className={`mt-0.5 flex-shrink-0 ${plan.highlight ? "text-[#D4AF37]" : "text-[#0A4DA6]"}`}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#register-form"
                  className={`w-full min-h-[44px] flex items-center justify-center gap-1 font-extrabold text-xs rounded-full transition-all ${plan.highlight ? "bg-white text-[#0A4DA6] hover:bg-blue-50" : "bg-[#0A4DA6] text-white hover:bg-opacity-90"}`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="register-form"
        className="max-w-2xl mx-auto px-4 sm:px-6 py-14"
      >
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center space-y-1">
            <h2
              className="font-extrabold text-[#0B192C] dark:text-white"
              style={{ fontSize: "clamp(1.1rem, 4vw, 1.4rem)" }}
            >
              Register Your Ashram
            </h2>
            <p className="text-xs text-gray-500">
              Our team will contact you within 24 hours to begin the
              verification process.
            </p>
          </div>
          {submitted ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle size={48} className="text-[#0E7B6C] mx-auto" />
              <h3 className="font-extrabold text-[#0B192C] dark:text-white">
                Thank You!
              </h3>
              <p className="text-sm text-gray-500">
                Our partnership team will reach out to you within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                {
                  label: "Your Name",
                  key: "name",
                  placeholder: "Swami Dayanand Ji",
                  type: "text",
                },
                {
                  label: "Ashram / Retreat Name",
                  key: "ashramName",
                  placeholder: "Swami Dayanand Ashram Trust",
                  type: "text",
                },
                {
                  label: "Location (City, State)",
                  key: "location",
                  placeholder: "Rishikesh, Uttarakhand",
                  type: "text",
                },
                {
                  label: "Phone Number",
                  key: "phone",
                  placeholder: "+91 98765 43210",
                  type: "tel",
                },
                {
                  label: "Email Address",
                  key: "email",
                  placeholder: "ashram@example.com",
                  type: "email",
                },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-[10px] font-extrabold tracking-wider text-gray-400 mb-1.5">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    required
                    placeholder={field.placeholder}
                    value={(form as any)[field.key]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [field.key]: e.target.value }))
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 text-[#0B192C] dark:text-white placeholder:text-gray-300"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-extrabold tracking-wider text-gray-400 mb-1.5">
                  Additional Information
                </label>
                <textarea
                  rows={3}
                  placeholder="Tell us about your ashram — capacity, facilities, daily schedule..."
                  value={form.message}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, message: e.target.value }))
                  }
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 text-[#0B192C] dark:text-white placeholder:text-gray-300"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[52px] bg-[#0A4DA6] text-white font-extrabold text-sm rounded-full flex items-center justify-center gap-2 shadow-lg"
              >
                Submit Registration <ArrowRight size={15} />
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
export default PartnerPage;
