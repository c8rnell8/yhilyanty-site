import {
  CheckCircleIcon,
  DiscordLogoIcon,
  LockKeyIcon,
  MegaphoneIcon,
  UsersThreeIcon,
  TargetIcon,
  XCircleIcon,
  ChatCenteredDotsIcon,
  TextTIcon,
  ImageIcon,
  ArrowRightIcon,
  StackIcon,
  FileTextIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react/dist/ssr";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { avatarUrl, getSession, isOwner } from "@/lib/auth";
import { Link } from "@/i18n/navigation";

const MOCK_APPLICATIONS = [
  { callsign: "@Vova_Pole", age: 19, exp: "Squad 320h, Arma 80h", status: "pending" as const },
  { callsign: "@Stas_Mzh", age: 24, exp: "Squad 1200h, Arma 200h", status: "pending" as const },
  { callsign: "@Kit_47", age: 17, exp: "Squad 88h", status: "interview" as const },
  { callsign: "@DenchikUA", age: 28, exp: "Arma 600h, Squad 40h", status: "pending" as const },
];

const STATUS_CLASS = {
  pending: "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:var(--accent)]/30",
  interview: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
} as const;

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin");

  const session = await getSession();
  const owner = isOwner(session);

  if (!owner) {
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

  const tiles = [
    {
      key: "applications" as const,
      icon: ChatCenteredDotsIcon,
    },
    {
      key: "announcements" as const,
      icon: MegaphoneIcon,
    },
    {
      key: "operations" as const,
      icon: TargetIcon,
    },
    {
      key: "members" as const,
      icon: UsersThreeIcon,
    },
  ];

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
            <span className="tactical-text text-[color:var(--accent)]">CMD</span>
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
        <Link
          href="/admin/content"
          className="group rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]/40 p-5 flex items-start gap-4 hover:border-[color:var(--accent)] transition-colors"
        >
          <div className="size-12 rounded-sm bg-[color:var(--accent)] flex items-center justify-center shrink-0">
            <TextTIcon className="size-6 text-black" weight="bold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-base tracking-tight">Тексти</h3>
              <ArrowRightIcon
                className="size-4 text-[color:var(--accent)] transition-transform group-hover:translate-x-1"
                weight="bold"
              />
            </div>
            <p className="text-sm text-[color:var(--muted-2)] leading-relaxed mt-1">
              Редагуй кожний напис на сайті по 3 мовах. Зміни застосовуються миттєво.
            </p>
          </div>
        </Link>
        <Link
          href="/admin/images"
          className="group rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]/40 p-5 flex items-start gap-4 hover:border-[color:var(--accent)] transition-colors"
        >
          <div className="size-12 rounded-sm bg-[color:var(--accent)] flex items-center justify-center shrink-0">
            <ImageIcon className="size-6 text-black" weight="bold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-base tracking-tight">Зображення</h3>
              <ArrowRightIcon
                className="size-4 text-[color:var(--accent)] transition-transform group-hover:translate-x-1"
                weight="bold"
              />
            </div>
            <p className="text-sm text-[color:var(--muted-2)] leading-relaxed mt-1">
              Заливай нові фото — старі замінюються в галереї та на детальних сторінках.
            </p>
          </div>
        </Link>
        <Link
          href="/admin/layout-editor"
          className="group rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]/40 p-5 flex items-start gap-4 hover:border-[color:var(--accent)] transition-colors"
        >
          <div className="size-12 rounded-sm bg-[color:var(--accent)] flex items-center justify-center shrink-0">
            <StackIcon className="size-6 text-black" weight="bold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-base tracking-tight">Секції лендінгу</h3>
              <ArrowRightIcon
                className="size-4 text-[color:var(--accent)] transition-transform group-hover:translate-x-1"
                weight="bold"
              />
            </div>
            <p className="text-sm text-[color:var(--muted-2)] leading-relaxed mt-1">
              Переставляй порядок або ховай цілі блоки головної сторінки.
            </p>
          </div>
        </Link>
        <Link
          href="/admin/pages"
          className="group rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]/40 p-5 flex items-start gap-4 hover:border-[color:var(--accent)] transition-colors"
        >
          <div className="size-12 rounded-sm bg-[color:var(--accent)] flex items-center justify-center shrink-0">
            <FileTextIcon className="size-6 text-black" weight="bold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-base tracking-tight">Сторінки</h3>
              <ArrowRightIcon
                className="size-4 text-[color:var(--accent)] transition-transform group-hover:translate-x-1"
                weight="bold"
              />
            </div>
            <p className="text-sm text-[color:var(--muted-2)] leading-relaxed mt-1">
              Створюй та редагуй власні сторінки. Текст, зображення, галерея, CTA-кнопки.
            </p>
          </div>
        </Link>
        <Link
          href="/admin/nav"
          className="group rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]/40 p-5 flex items-start gap-4 hover:border-[color:var(--accent)] transition-colors"
        >
          <div className="size-12 rounded-sm bg-[color:var(--accent)] flex items-center justify-center shrink-0">
            <TreeStructureIcon className="size-6 text-black" weight="bold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-base tracking-tight">Навбар і футер</h3>
              <ArrowRightIcon
                className="size-4 text-[color:var(--accent)] transition-transform group-hover:translate-x-1"
                weight="bold"
              />
            </div>
            <p className="text-sm text-[color:var(--muted-2)] leading-relaxed mt-1">
              Додавай, перейменовуй, переставляй або ховай пункти меню зверху і внизу сайту.
            </p>
          </div>
        </Link>
      </div>

      <div className="grid gap-px bg-[color:var(--border)] border border-[color:var(--border)] sm:grid-cols-2 lg:grid-cols-4 mb-12">
        {tiles.map(({ key, icon: Icon }) => (
          <div
            key={key}
            className="bg-[color:var(--background-elev)] p-6 flex flex-col gap-3"
          >
            <div className="size-10 rounded-sm bg-[color:var(--accent-soft)] flex items-center justify-center">
              <Icon className="size-5 text-[color:var(--accent)]" weight="bold" />
            </div>
            <h3 className="font-bold tracking-tight">{t(`tiles.${key}` as "tiles.applications")}</h3>
            <p className="text-sm text-[color:var(--muted-2)] leading-relaxed">
              {t(`tiles.${key}Body` as "tiles.applicationsBody")}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] overflow-hidden">
        <header className="flex items-center justify-between p-5 border-b border-[color:var(--border)]">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold tracking-tight">{t("preview.title")}</h3>
            <p className="text-sm text-[color:var(--muted-2)]">{t("preview.subtitle")}</p>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left">
                <th className="px-5 py-3 tactical-text font-normal">
                  {t("preview.columns.callsign")}
                </th>
                <th className="px-5 py-3 tactical-text font-normal">{t("preview.columns.age")}</th>
                <th className="px-5 py-3 tactical-text font-normal">{t("preview.columns.exp")}</th>
                <th className="px-5 py-3 tactical-text font-normal">
                  {t("preview.columns.status")}
                </th>
                <th className="px-5 py-3 tactical-text font-normal text-right">
                  {t("preview.columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_APPLICATIONS.map((a) => (
                <tr
                  key={a.callsign}
                  className="border-b border-[color:var(--border)] last:border-b-0"
                >
                  <td className="px-5 py-4 font-mono">{a.callsign}</td>
                  <td className="px-5 py-4 font-mono text-[color:var(--muted-2)]">{a.age}</td>
                  <td className="px-5 py-4 text-[color:var(--muted-2)]">{a.exp}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-sm font-mono uppercase text-[10px] tracking-[0.16em] border ${STATUS_CLASS[a.status]}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border)] hover:border-emerald-500/40 hover:text-emerald-300 transition-colors text-xs font-mono uppercase tracking-[0.1em]"
                      >
                        <CheckCircleIcon className="size-3.5" weight="bold" />
                        {t("preview.actions.approve")}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border)] hover:border-rose-500/40 hover:text-rose-300 transition-colors text-xs font-mono uppercase tracking-[0.1em]"
                      >
                        <XCircleIcon className="size-3.5" weight="bold" />
                        {t("preview.actions.reject")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
