import React, { useState } from "react";
import {
  Briefcase,
  MapPin,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const openings = [
  {
    title: "Field Executive – Ashram Verification",
    location: "Rishikesh / Varanasi / Haridwar",
    type: "Full Time",
    dept: "Operations",
    desc: "Physically visit and onboard ashrams, collect data using our tablet-based wizard, and ensure quality standards are met.",
  },
  {
    title: "Full Stack Engineer (React + Node)",
    location: "Remote / Noida",
    type: "Full Time",
    dept: "Engineering",
    desc: "Build and maintain the Tirvona web platform. Experience with TypeScript, React, MongoDB and REST APIs required.",
  },
  {
    title: "Digital Marketing Manager",
    location: "Noida / Remote",
    type: "Full Time",
    dept: "Marketing",
    desc: "Drive pilgrim acquisition through SEO, social media, and temple community outreach programs.",
  },
  {
    title: "Customer Support Executive",
    location: "Remote",
    type: "Full Time",
    dept: "Support",
    desc: "Assist pilgrims with bookings, refunds and spiritual stay queries in Hindi and English.",
  },
  {
    title: "Business Development Manager – Partnerships",
    location: "Pan India",
    type: "Full Time",
    dept: "Growth",
    desc: "Build relationships with ashram trusts, temple boards, and state tourism boards to expand Tirvona's verified network.",
  },
  {
    title: "UI/UX Designer",
    location: "Remote / Noida",
    type: "Full Time",
    dept: "Design",
    desc: "Design intuitive, culturally sensitive digital experiences for pilgrims across mobile and web.",
  },
];

const perks = [
  "🏥 Health insurance for self & family",
  "🌿 Work from ashram — remote work supported",
  "📚 ₹20,000 annual learning budget",
  "✈️ Spiritual travel expense reimbursement",
  "🎯 Performance bonuses every quarter",
  "🧘 Meditation & yoga sessions twice a week",
];

const CareersPage: React.FC = () => {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>("All");
  const depts = [
    "All",
    "Engineering",
    "Operations",
    "Marketing",
    "Support",
    "Growth",
    "Design",
  ];
  const filtered =
    selectedDept === "All"
      ? openings
      : openings.filter((o) => o.dept === selectedDept);

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="bg-[#0B192C] text-white py-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#0A4DA6]/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
            Join The Team
          </span>
          <h1
            className="font-extrabold leading-tight text-white"
            style={{ fontSize: "clamp(1.8rem, 6vw, 3rem)" }}
          >
            Build India's Sacred{" "}
            <span className="text-[#D4AF37]">Travel Future</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl mx-auto">
            We're a team of engineers, field executives, and spiritual
            enthusiasts on a mission to transform how India travels to its holy
            destinations.
          </p>
        </div>
      </section>

      {/* Why work with us */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 space-y-10">
        <div className="text-center space-y-2">
          <h2
            className="font-extrabold text-[#0B192C] dark:text-white"
            style={{ fontSize: "clamp(1.3rem, 4vw, 1.875rem)" }}
          >
            Why Work at Tirvona?
          </h2>
          <p className="text-sm text-gray-500">
            More than a job — a meaningful mission.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {perks.map((perk, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 text-sm text-gray-700 dark:text-gray-200 font-semibold shadow-sm"
            >
              {perk}
            </div>
          ))}
        </div>
      </section>

      {/* Job listings */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-14 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2
            className="font-extrabold text-[#0B192C] dark:text-white"
            style={{ fontSize: "clamp(1.1rem, 4vw, 1.5rem)" }}
          >
            Open Positions
          </h2>
          {/* Dept filter */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {depts.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDept(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${selectedDept === d ? "bg-[#0A4DA6] text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((job, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
            >
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full text-left p-5 flex items-start justify-between gap-4 cursor-pointer"
              >
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                    {job.title}
                  </h3>
                  <div className="flex flex-wrap gap-3 text-[10px] text-gray-400 font-bold">
                    <span className="flex items-center gap-1">
                      <MapPin size={10} className="text-[#0A4DA6]" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} className="text-[#0E7B6C]" />
                      {job.type}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase size={10} className="text-[#6B21A8]" />
                      {job.dept}
                    </span>
                  </div>
                </div>
                {expanded === i ? (
                  <ChevronUp
                    size={16}
                    className="text-gray-400 mt-1 flex-shrink-0"
                  />
                ) : (
                  <ChevronDown
                    size={16}
                    className="text-gray-400 mt-1 flex-shrink-0"
                  />
                )}
              </button>
              {expanded === i && (
                <div className="px-5 pb-5 space-y-4 border-t border-gray-50 dark:border-slate-800 pt-4">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {job.desc}
                  </p>
                  <a
                    href="mailto:careers@tirvona.in"
                    className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2 bg-[#0A4DA6] text-white text-xs font-extrabold rounded-full"
                  >
                    Apply Now <ArrowRight size={13} />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 text-center space-y-3">
          <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
            Don't see your role?
          </h3>
          <p className="text-xs text-gray-500">
            We're always looking for passionate people. Drop your resume and
            we'll reach out when something fits.
          </p>
          <a
            href="mailto:careers@tirvona.in"
            className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2 bg-[#D4AF37] text-[#0B192C] text-xs font-extrabold rounded-full"
          >
            Send Open Application
          </a>
        </div>
      </section>
    </div>
  );
};
export default CareersPage;
