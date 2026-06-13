import {
  DiscordLogoIcon,
  LockKeyIcon,
  ImageIcon,
  ArrowRightIcon,
  RobotIcon,
  PackageIcon,
  UsersIcon,
  GearSixIcon,
  FilmStripIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { avatarUrl, getSession } from "@/lib/auth";
import { getRole, roleAtLeast, type Role } from "@/lib/roles";
import { Link } from "@/i18n/navigation";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin");

  const session = await getSession();
  const role = await getRole(session);

  if (!role) {
    return (
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-16 lg:py-24">
        <div className="max-w-3xl flex flex-col gap-3 mb-12">
          <span className="tactical-text text-[color:var(--accent)]">{t("eyebrow")}</span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-lg text-[color:var(--muted-2)]">{t("subtitle")}</p>
        </div>

        <div className="frame mx-auto max-w-2xl rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-10 flex flex-col items-center text-center gap-5">
          <div className="size-14 rounded-sm bg-[color:var(--accent-soft)] flex items-center justify-center">
            <LockKeyIcon className="size-6 text-[color:var(--accent)]" weight="bold" />
          </div>
          <h2 className="text-2xl font-bold">{t("locked.title")}</h2>
          <p className="text-sm text-[color:var(--muted-2)] leading-relaxed max-w-md">
            {t("locked.body")}
          </p>
          {session ? (
            <div className="flex items-center gap-3 p-3 rounded-sm bg-black/30 border border-[color:var(--border)] w-full max-w-sm">
              {avatarUrl(session) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl(session) as string}
                  alt=""
                  className="size-9 rounded-full"
                />
              ) : null}
              <div className="flex flex-col leading-tight text-left flex-1 min-w-0">
                <span className="font-mono text-sm truncate">
                  {session.globalName || session.username}
                </span>
                <span className="font-mono text-[10px] text-[color:var(--muted)] truncate">
                  ID · {session.id}
                </span>
              </div>
              <a
                href="/api/auth/logout"
                className="text-xs font-mono uppercase tracking-[0.12em] text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
              >
                logout
              </a>
            </div>
          ) : (
            <a
              href={`/api/auth/login?returnTo=/${locale}/admin`}
              className="inline-flex items-center gap-2 px-5 h-11 rounded-sm btn-primary text-sm font-mono uppercase tracking-[0.16em]"
            >
              <DiscordLogoIcon className="size-4" weight="fill" />
              Sign in with Discord
            </a>
          )}
        </div>
      </section>
    );
  }

  const cards: {
    key:
      | "content"
      | "images"
      | "layout"
      | "pages"
      | "nav"
      | "ai"
      | "orders"
      | "team"
      | "system"
      | "media";
    href: string;
    icon: typeof ImageIcon;
    min: Role;
  }[] = [
    // Texts, sections, pages and nav now live behind the "Edit site" button
    // on the live site — no separate cards here anymore.
    { key: "images", href: "/admin/images", icon: ImageIcon, min: "editor" },
    { key: "media", href: "/admin/media", icon: FilmStripIcon, min: "editor" },
    { key: "ai", href: "/admin/ai", icon: RobotIcon, min: "editor" },
    { key: "orders", href: "/admin/orders", icon: PackageIcon, min: "admin" },
    { key: "team", href: "/admin/team", icon: UsersIcon, min: "owner" },
    { key: "system", href: "/admin/system", icon: GearSixIcon, min: "owner" },
  ];
  const visibleCards = cards.filter((c) => roleAtLeast(role, c.min));

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-16 lg:py-24">
      <div className="flex items-start justify-between mb-12 gap-6 flex-wrap">
        <div className="flex flex-col gap-3 max-w-3xl">
          <span className="tactical-text text-[color:var(--accent)]">{t("eyebrow")}</span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-lg text-[color:var(--muted-2)]">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-sm bg-[color:var(--background-elev)] border border-[color:var(--accent)]/40">
          {session && avatarUrl(session) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl(session) as string} alt="" className="size-9 rounded-full" />
          ) : null}
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-sm">{session?.globalName || session?.username}</span>
            <span className="tactical-text text-[color:var(--accent)]">{role.toUpperCase()}</span>
          </div>
          <a
            href="/api/auth/logout"
            className="text-xs font-mono uppercase tracking-[0.12em] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] ml-2"
          >
            logout
          </a>
        </div>
      </div>

      {/* CMS quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-10">
        {visibleCards.map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className="group rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]/40 p-5 flex items-start gap-4 hover:border-[color:var(--accent)] transition-colors"
          >
            <div className="size-12 rounded-sm bg-[color:var(--accent)] flex items-center justify-center shrink-0">
              <Icon className="size-6 text-black" weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-base tracking-tight">
                  {t(`cards.${key}.title`)}
                </h3>
                <ArrowRightIcon
                  className="size-4 text-[color:var(--accent)] transition-transform group-hover:translate-x-1"
                  weight="bold"
                />
              </div>
              <p className="text-sm text-[color:var(--muted-2)] leading-relaxed mt-1">
                {t(`cards.${key}.body`)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-5 flex items-start gap-3">
        <PencilSimpleIcon className="size-5 text-[color:var(--accent)] shrink-0 mt-0.5" weight="bold" />
        <p className="text-sm text-[color:var(--muted-2)] leading-relaxed">
          {t("liveEditHint")}
        </p>
      </div>
    </section>
  );
}
