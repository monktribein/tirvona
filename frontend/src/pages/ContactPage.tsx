import React, { useState, useEffect } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { useProfileAutoFill } from "../hooks/useProfileAutoFill";

const ContactPage: React.FC = () => {
  const autoFill = useProfileAutoFill();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (autoFill.isLoggedIn) {
      setForm((prev) => ({
        ...prev,
        name: prev.name || autoFill.name,
        email: prev.email || autoFill.email,
        phone: prev.phone || autoFill.phone,
      }));
    }
  }, [autoFill]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const offices = [
    {
      city: "Noida (HQ)",
      address:
        "3rd Floor, ITHUM TOWER, 307B, A A-40, Sector 62, Noida, Uttar Pradesh 201301",
      phone: "+91 78360 55511",
      email: "info@nktech.in",
    },
    {
      city: "Rishikesh (Field Office)",
      address: "Near Laxman Jhula, Tapovan, Rishikesh, Uttarakhand 249192",
      phone: "+91 98765 00001",
      email: "rishikesh@tirvona.in",
    },
    {
      city: "Varanasi (Field Office)",
      address: "Near Dashashwamedh Ghat, Godowlia, Varanasi, UP 221001",
      phone: "+91 98765 00002",
      email: "varanasi@tirvona.in",
    },
  ];

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="bg-[#0B192C] text-white py-14 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#0A4DA6]/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative z-10 space-y-4">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
            Get In Touch
          </span>
          <h1
            className="font-extrabold text-white"
            style={{ fontSize: "clamp(1.8rem, 6vw, 3rem)" }}
          >
            Contact <span className="text-[#D4AF37]">Us</span>
          </h1>
          <p className="text-sm text-gray-300 leading-relaxed max-w-lg mx-auto">
            Have a question, feedback, or need help? Our team is ready to assist
            you 24/7.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Contact Form */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="font-extrabold text-[#0B192C] dark:text-white text-lg">
              Send us a message
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              We'll get back to you within 2–4 hours.
            </p>
          </div>
          {submitted ? (
            <div className="text-center py-10 space-y-3">
              <CheckCircle size={48} className="text-[#0E7B6C] mx-auto" />
              <h3 className="font-extrabold text-[#0B192C] dark:text-white">
                Message Sent!
              </h3>
              <p className="text-sm text-gray-500">
                Our team will respond to your query shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    label: "Full Name",
                    key: "name",
                    placeholder: "Your Name",
                    type: "text",
                  },
                  {
                    label: "Email Address",
                    key: "email",
                    placeholder: "you@example.com",
                    type: "email",
                  },
                  {
                    label: "Phone (Optional)",
                    key: "phone",
                    placeholder: "+91 XXXXX XXXXX",
                    type: "tel",
                  },
                  {
                    label: "Subject",
                    key: "subject",
                    placeholder: "How can we help?",
                    type: "text",
                  },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5">
                      {f.label}
                    </label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      required={f.key !== "phone"}
                      value={(form as any)[f.key]}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [f.key]: e.target.value,
                        }))
                      }
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 text-[#0B192C] dark:text-white placeholder:text-gray-300"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5">
                  Message
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your query in detail..."
                  value={form.message}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, message: e.target.value }))
                  }
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 text-[#0B192C] dark:text-white placeholder:text-gray-300"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[52px] bg-[#0A4DA6] text-white font-extrabold text-sm rounded-full flex items-center justify-center gap-2 shadow-lg"
              >
                Send Message <ArrowRight size={15} />
              </button>
            </form>
          )}
        </div>

        {/* Contact Info */}
        <div className="space-y-6">
          {/* Quick contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: <Phone size={18} className="text-[#0A4DA6]" />,
                label: "Phone",
                val: "+91 78360 55511",
                sub: "Mon–Sun, 9am–9pm IST",
              },
              {
                icon: <Mail size={18} className="text-[#0A4DA6]" />,
                label: "Email",
                val: "info@nktech.in",
                sub: "Reply within 2 hours",
              },
              {
                icon: <Clock size={18} className="text-[#0A4DA6]" />,
                label: "Emergency",
                val: "24/7 Support",
                sub: "Medical & safety only",
              },
              {
                icon: <MapPin size={18} className="text-[#0A4DA6]" />,
                label: "HQ Address",
                val: "Sector 62, Noida",
                sub: "Uttar Pradesh 201301",
              },
            ].map((c, i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-[#0A4DA6]/5 border border-[#0A4DA6]/10 flex items-center justify-center">
                  {c.icon}
                </div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  {c.label}
                </p>
                <p className="text-sm font-extrabold text-[#0B192C] dark:text-white">
                  {c.val}
                </p>
                <p className="text-[10px] text-gray-400">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Office locations */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
              Our Offices
            </h3>
            {offices.map((o, i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-1.5 shadow-sm"
              >
                <h4 className="font-extrabold text-xs text-[#0A4DA6]">
                  {o.city}
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed flex items-start gap-1.5">
                  <MapPin
                    size={10}
                    className="mt-0.5 flex-shrink-0 text-[#0A4DA6]"
                  />
                  {o.address}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Phone size={10} className="text-[#0A4DA6]" />
                  {o.phone}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Mail size={10} className="text-[#0A4DA6]" />
                  {o.email}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default ContactPage;
