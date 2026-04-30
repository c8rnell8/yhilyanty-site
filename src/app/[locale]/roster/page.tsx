import { getTranslations, setRequestLocale } from "next-intl/server";

type Member = {
  callsign: string;
  role: "lead" | "ftl" | "medic" | "marksman" | "rifleman" | "drone" | "armor";
  spec: string;
  voice: number;
  since: string;
};

const ROLE_BG: Record<Member["role"], string> = {
  lead: "bg-[color:var(--accent)] text-black",
  ftl: "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border border-[color:var(--accent)]/40",
  medic: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  marksman: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
  rifleman: "bg-white/5 text-[color:var(--muted-2)] border border-[color:var(--border)]",
  drone: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30",
  armor: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
};

export default async function RosterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Roster");
  const members = (t.raw("members") ?? []) as Member[];

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-16 lg:py-24">
      <div className="max-w-3xl flex flex-col gap-3 mb-12">
        <span className="tactical-text text-[color:var(--accent)]">001 / PERSONNEL</span>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-lg text-[color:var(--muted-2)]">{t("subtitle")}</p>
      </div>

      <div className="frame rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--border)] text-left">
              <th className="px-5 py-4 tactical-text font-normal">{t("columns.callsign")}</th>
              <th className="px-5 py-4 tactical-text font-normal">{t("columns.role")}</th>
              <th className="px-5 py-4 tactical-text font-normal">{t("columns.spec")}</th>
              <th className="px-5 py-4 tactical-text font-normal text-right">{t("columns.voice")}</th>
              <th className="px-5 py-4 tactical-text font-normal text-right">{t("columns.since")}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, idx) => (
              <tr
                key={m.callsign + idx}
                className="border-b border-[color:var(--border)] last:border-b-0 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-5 py-4 font-mono">{m.callsign}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-sm font-mono uppercase text-[10px] tracking-[0.16em] ${ROLE_BG[m.role]}`}
                  >
                    {t(`roles.${m.role}` as "roles.lead")}
                  </span>
                </td>
                <td className="px-5 py-4 text-[color:var(--muted-2)]">{m.spec}</td>
                <td className="px-5 py-4 font-mono text-right">{m.voice}h</td>
                <td className="px-5 py-4 font-mono text-right text-[color:var(--muted)]">{m.since}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
