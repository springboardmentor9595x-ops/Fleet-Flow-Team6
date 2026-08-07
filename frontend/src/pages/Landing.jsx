import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, ShieldCheck, Sparkles, Truck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../api/axios";

const features = [
  { title: "Unified Fleet Visibility", detail: "Track vehicles, drivers, routes and maintenance in one polished control center.", icon: BarChart3, color: "#6366f1", bg: "#f5f3ff", border: "#ddd6fe" },
  { title: "Smart Dispatching",        detail: "Assign trips instantly with real-time updates and workflow automation.",           icon: Truck,    color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  { title: "Role-Aware Experience",    detail: "Every team member sees the right tools, insights, and actions for their role.",   icon: Users,    color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
];

const testimonials = [
  { quote: "FleetFlow gave us a beautiful command center in days.", name: "Alicia Gomez", role: "Operations Lead" },
  { quote: "The experience feels as polished as our best SaaS tools.",  name: "Darius Kim",  role: "VP Logistics"    },
];

export default function Landing() {
  const [stats, setStats] = useState({
    vehicles: "0",
    onTime: "0%",
    activeRoutes: "0",
    maintenanceAlerts: "0",
  });

  useEffect(() => {
    let active = true;
    async function fetchStats() {
      try {
        const response = await api.get("/dashboard/summary");
        if (active) {
          const data = response.data;
          const totalVehicles = data.find(item => item.label === "Total Vehicles")?.value || "0";
          const activeTrips = data.find(item => item.label === "Active Trips")?.value || "0";
          const maintenanceDue = data.find(item => item.label === "Maintenance Due")?.value || "0";
          const onTimeRate = data.find(item => item.label === "On-Time Rate")?.value || "0%";
          setStats({
            vehicles: totalVehicles,
            activeRoutes: activeTrips,
            maintenanceAlerts: maintenanceDue,
            onTime: onTimeRate,
          });
        }
      } catch (err) {
        console.error("Failed to fetch landing stats", err);
      }
    }
    fetchStats();
    return () => { active = false; };
  }, []);

  const statItems = [
    { value: stats.vehicles,  label: "Vehicles managed"  },
    { value: stats.onTime, label: "On-time delivery"  },
    { value: stats.activeRoutes,    label: "Active routes"      },
    { value: stats.maintenanceAlerts,     label: "Maintenance alerts" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>

      {/* ── Navbar ── */}
      <header style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(15,23,42,0.07)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: "68px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ borderRadius: "0.875rem", background: "linear-gradient(135deg,#6366f1,#3b82f6)", padding: "0.5rem 0.625rem", display: "flex", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>
              <Truck size={20} color="white" />
            </div>
            <div>
              <p style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#0f172a" }}>FleetFlow</p>
              <p style={{ fontSize: "0.6875rem", color: "#94a3b8", lineHeight: 1 }}>Modern fleet operations</p>
            </div>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: "2rem" }} className="desktop-nav">
            {["Features", "About", "FAQ"].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} style={{ fontSize: "0.9375rem", color: "#475569", fontWeight: 500, transition: "color 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#6366f1"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#475569"}>
                {item}
              </a>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Link to="/login" className="ff-btn-ghost" style={{ padding: "0.5rem 1.125rem" }}>Login</Link>
            <Link to="/signup" className="ff-btn-primary" style={{ padding: "0.5rem 1.125rem" }}>Start free</Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1.5rem 5rem" }}>

        {/* ── Hero ── */}
        <section style={{ paddingTop: "5rem", paddingBottom: "4rem" }}>
          <div style={{ display: "grid", alignItems: "center", gap: "3rem", gridTemplateColumns: "1fr" }} className="hero-grid">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: "9999px", padding: "0.375rem 0.875rem", fontSize: "0.8125rem", color: "#6d28d9", fontWeight: 500, marginBottom: "1.5rem" }}>
                <Sparkles size={13} />
                AI-powered fleet intelligence
              </div>

              <h1 style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#0f172a", marginBottom: "1.25rem" }}>
                Run every route, vehicle,{" "}
                <span className="ff-gradient-text">and driver</span> from a premium control center.
              </h1>

              <p style={{ fontSize: "1.125rem", color: "#475569", lineHeight: 1.75, maxWidth: "520px", marginBottom: "2rem" }}>
                FleetFlow combines dispatching, maintenance tracking, and role-aware analytics into one elegant SaaS dashboard for modern operations teams.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.875rem" }}>
                <Link to="/signup" className="ff-btn-primary" style={{ padding: "0.875rem 1.75rem", fontSize: "1rem" }}>
                  Create your workspace <ArrowRight size={17} />
                </Link>
                <Link to="/login" className="ff-btn-ghost" style={{ padding: "0.875rem 1.75rem", fontSize: "1rem" }}>
                  Explore demo
                </Link>
              </div>
            </motion.div>

            {/* Live stats card */}
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }}
              style={{ background: "white", border: "1.5px solid rgba(15,23,42,0.08)", borderRadius: "1.75rem", padding: "1.75rem", boxShadow: "0 20px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.05)" }}>
              <div style={{ background: "linear-gradient(135deg, #f5f3ff, #eff6ff)", border: "1px solid #ddd6fe", borderRadius: "1.25rem", padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                  <div>
                    <p style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 500 }}>Live operations</p>
                    <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>{stats.onTime} on-time delivery</p>
                  </div>
                  <div style={{ borderRadius: "0.875rem", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "0.75rem" }}>
                    <ShieldCheck size={18} color="#059669" />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {[["Vehicles monitored", stats.vehicles], ["Active routes", stats.activeRoutes], ["Maintenance alerts", stats.maintenanceAlerts]].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "0.875rem", background: "white", border: "1px solid rgba(15,23,42,0.07)", padding: "0.75rem 1rem", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>
                      <span style={{ fontSize: "0.875rem", color: "#64748b" }}>{label}</span>
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats strip */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "5rem" }}>
          {statItems.map(({ value, label }) => (
            <div key={label} style={{ background: "white", border: "1.5px solid rgba(15,23,42,0.07)", borderRadius: "1.25rem", padding: "1.25rem 1.5rem", textAlign: "center", boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
              <p style={{ fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-0.02em" }} className="ff-gradient-text">{value}</p>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem", fontWeight: 500 }}>{label}</p>
            </div>
          ))}
        </section>

        {/* ── Features ── */}
        <section id="features" style={{ marginBottom: "5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <p style={{ fontSize: "0.8125rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6366f1", marginBottom: "0.75rem" }}>Why FleetFlow?</p>
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>
              Everything your team needs in one place.
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
            {features.map(({ title, detail, icon: Icon, color, bg, border }, idx) => (
              <motion.div key={title}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -4, boxShadow: "0 16px 40px rgba(15,23,42,0.10)" }}
                style={{ background: "white", border: `1.5px solid ${border}`, borderRadius: "1.5rem", padding: "2rem", boxShadow: "0 2px 8px rgba(15,23,42,0.05)", cursor: "default", transition: "box-shadow 0.2s, transform 0.2s" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "0.875rem", background: bg, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
                  <Icon size={22} color={color} />
                </div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>{title}</h3>
                <p style={{ fontSize: "0.9375rem", color: "#64748b", lineHeight: 1.65 }}>{detail}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section id="about" style={{ background: "linear-gradient(135deg, #f5f3ff, #eff6ff)", border: "1.5px solid #ddd6fe", borderRadius: "2rem", padding: "3.5rem", marginBottom: "2rem" }}>
          <div style={{ display: "grid", gap: "3rem", gridTemplateColumns: "1fr" }} className="testimonial-grid">
            <div>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6366f1", marginBottom: "1rem" }}>Trusted by growing fleets</p>
              <h2 style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1.3 }}>
                Built for operators who care about craft and speed.
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {testimonials.map((item) => (
                <div key={item.name} style={{ background: "white", border: "1px solid rgba(15,23,42,0.07)", borderRadius: "1.125rem", padding: "1.375rem", boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
                  <p style={{ color: "#334155", lineHeight: 1.6, fontStyle: "italic" }}>"{item.quote}"</p>
                  <p style={{ marginTop: "0.875rem", fontWeight: 700, color: "#0f172a", fontSize: "0.9375rem" }}>{item.name}</p>
                  <p style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>{item.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", marginBottom: "1rem" }}>
            Ready to streamline your fleet?
          </h2>
          <p style={{ color: "#64748b", fontSize: "1.0625rem", marginBottom: "2rem" }}>
            Join 500+ operations teams already using FleetFlow.
          </p>
          <Link to="/signup" className="ff-btn-primary" style={{ padding: "1rem 2.5rem", fontSize: "1rem" }}>
            Get started for free <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ background: "white", borderTop: "1.5px solid rgba(15,23,42,0.07)", padding: "2rem 1.5rem", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div style={{ borderRadius: "0.75rem", background: "linear-gradient(135deg,#6366f1,#3b82f6)", padding: "0.375rem 0.5rem", display: "flex" }}>
            <Truck size={14} color="white" />
          </div>
          <span style={{ fontWeight: 700, color: "#0f172a" }}>FleetFlow</span>
        </div>
        <p style={{ fontSize: "0.875rem", color: "#94a3b8" }}>© 2026 FleetFlow. Crafted for ambitious fleet teams.</p>
      </footer>

      <style>{`
        @media (min-width: 900px) {
          .hero-grid { grid-template-columns: 1.1fr 0.9fr !important; }
          .testimonial-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
