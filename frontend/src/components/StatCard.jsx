import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

export default function StatCard({ title, value, delta, icon: Icon, accent = "from-blue-500 via-indigo-500 to-violet-500" }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      className={`rounded-3xl border border-white/10 bg-gradient-to-br ${accent} p-[1px] shadow-soft`}
    >
      <div className="rounded-[calc(1.5rem-1px)] bg-slate-950/95 p-5 backdrop-blur-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">{title}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 text-white">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
          <ArrowUpRight className="h-4 w-4" />
          <span>{delta}</span>
        </div>
      </div>
    </motion.div>
  );
}
