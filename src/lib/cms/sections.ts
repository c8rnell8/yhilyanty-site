/** Registry of reorderable/hideable sections on the landing page.
 *
 * Admin can reorder via /admin/layout and hide individual sections.
 * Layout is stored in .cms-overrides/layout.json keyed by "landing".
 */
export type SectionDef = {
  key: string;
  label: string;
  description: string;
};

export const LANDING_SECTIONS: SectionDef[] = [
  {
    key: "hero",
    label: "Геро-блок",
    description: "Перший екран з «У» та слоганом.",
  },
  {
    key: "about",
    label: "Про клан",
    description: "Блок з описом спільноти.",
  },
  {
    key: "games",
    label: "Ігри",
    description: "Картки Squad і Arma Reforger з Discord-посиланнями.",
  },
  {
    key: "gallery",
    label: "Галерея мерчу",
    description: "Три картки мерчу з кнопкою «Замовити».",
  },
  {
    key: "codex",
    label: "Кодекс",
    description: "Чотири правила спільноти.",
  },
  {
    key: "botPromo",
    label: "Бот-промо",
    description: "CTA-блок про веб-редактор у Discord.",
  },
  {
    key: "joinCta",
    label: "Заклик приєднатись",
    description: "Фінальний блок з кнопкою вступу.",
  },
];

export const LANDING_DEFAULT_ORDER = LANDING_SECTIONS.map((s) => s.key);
