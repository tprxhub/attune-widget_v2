import { cn } from "@/lib/utils";

export interface EditorSectionLink {
  id: string;
  title: string;
  issues: number;
}

export function HomepageEditorNavigation({
  sections,
  active,
  onSelect,
  superAdmin,
}: {
  sections: EditorSectionLink[];
  active: string;
  onSelect: (id: string) => void;
  superAdmin: boolean;
}) {
  const tools: EditorSectionLink[] = superAdmin
    ? [
        { id: "pricing", title: "Subscription pricing", issues: 0 },
        { id: "logo", title: "Application logo", issues: 0 },
      ]
    : [];
  const groups = [
    {
      title: "Homepage",
      items: sections.filter(
        (section) => !section.id.startsWith("policy-") && section.id !== "auth-images",
      ),
    },
    {
      title: "Account & policies",
      items: sections.filter(
        (section) => section.id.startsWith("policy-") || section.id === "auth-images",
      ),
    },
    {
      title: "Settings & reference",
      items: [...tools, { id: "dimensions", title: "Image dimensions", issues: 0 }],
    },
  ];
  return (
    <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <div className="ph-card p-4 lg:hidden">
        <label htmlFor="homepage-editor-section" className="block text-xs font-bold text-navy/60">
          Choose a section
        </label>
        <select
          id="homepage-editor-section"
          value={active}
          onChange={(event) => onSelect(event.target.value)}
          className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-navy/20 bg-card px-3 text-sm font-bold text-navy"
        >
          {groups.map((group) => (
            <optgroup key={group.title} label={group.title}>
              {group.items.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                  {section.issues ? ` · ${section.issues} to fix` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <nav
        aria-label="Editor sections"
        className="ph-card hidden max-h-[calc(100dvh-8rem)] space-y-4 overflow-y-auto p-3 lg:block"
      >
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1 text-[10px] font-bold tracking-widest text-navy/45 uppercase">
              {group.title}
            </p>
            {group.items.map((section) => (
              <button
                key={section.id}
                type="button"
                aria-current={active === section.id ? "page" : undefined}
                aria-controls={`editor-panel-${section.id}`}
                onClick={() => onSelect(section.id)}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors",
                  active === section.id ? "bg-amber text-navy" : "text-navy/70 hover:bg-navy/5",
                )}
              >
                <span>{section.title}</span>
                {section.issues > 0 && (
                  <span className="rounded-full bg-coral/15 px-1.5 text-[10px] text-coral">
                    {section.issues}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
