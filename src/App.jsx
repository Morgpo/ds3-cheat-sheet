import { useMemo, useState } from "react";
import cheatSheet from "../data/cheat-sheet.json";

const THEME_VAR = {
  "top-shelf": "var(--c-top-shelf)",
  neutral: "var(--c-neutral)",
  quality: "var(--c-quality)",
  strength: "var(--c-strength)",
  dexterity: "var(--c-dexterity)",
  sorcery: "var(--c-sorcery)",
  faith: "var(--c-faith)",
  "pyromancy-dark": "var(--c-pyromancy-dark)",
  "luck-bleed": "var(--c-luck-bleed)",
  armor: "var(--c-armor)",
  consumables: "var(--c-consumables)",
  caps: "var(--c-caps)"
};

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function itemText(item) {
  return typeof item === "string" ? item : item.text;
}

function itemStyle(item, fallbackTheme) {
  return typeof item === "string" ? fallbackTheme : item.style || fallbackTheme;
}

function capRowText(row) {
  return [
    row.attribute,
    row.metric,
    row.use,
    ...(row.breakpoints || []),
    row.note
  ].filter(Boolean).join(" ");
}

function getVisibleSection(section, query) {
  if (!query) {
    return { ...section, isSearchHidden: false };
  }

  if (section.type === "caps") {
    const rows = section.rows
      .map((row) => ({
        ...row,
        isSearchHidden: !normalizeText(capRowText(row)).includes(query)
      }));
    const note = section.note
      ? {
          ...section.note,
          isSearchHidden: !normalizeText(
            [section.note.title, ...(section.note.lines || [])].join(" ")
          ).includes(query)
        }
      : null;
    const hasVisibleEntry = rows.some((row) => !row.isSearchHidden) || (note && !note.isSearchHidden);

    return { ...section, rows, note, isSearchHidden: !hasVisibleEntry };
  }

  const groups = section.groups.map((group) => {
    const items = group.items.map((item) => ({
      value: item,
      isSearchHidden: !normalizeText(itemText(item)).includes(query)
    }));
    const hasVisibleItem = items.some((item) => !item.isSearchHidden);

    return { ...group, items, isSearchHidden: !hasVisibleItem };
  });
  const hasVisibleEntry = groups.some((group) => !group.isSearchHidden);

  return { ...section, groups, isSearchHidden: !hasVisibleEntry };
}

function buildTopShelfSet(sections) {
  const topShelfItems = sections
    .filter((section) => section.type === "top-shelf")
    .flatMap((section) => section.groups || [])
    .flatMap((group) => group.items.map(itemText));

  return new Set(topShelfItems);
}

function flattenSections(sections) {
  return [
    ...(sections.feature || []),
    ...(sections.main || []),
    ...(sections.lower || [])
  ];
}

function App() {
  const [search, setSearch] = useState("");
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());

  const query = normalizeText(search);
  const allSections = useMemo(() => flattenSections(cheatSheet.sections), []);
  const topShelfItems = useMemo(() => buildTopShelfSet(cheatSheet.sections.feature || []), []);
  const visibleSections = useMemo(
    () => new Map(allSections.map((section) => [section.id, getVisibleSection(section, query)])),
    [allSections, query]
  );
  const collapsedSections = allSections.filter((section) => collapsedIds.has(section.id));
  const featureSections = cheatSheet.sections.feature || [];
  const featureStackHidden = featureSections.every((section) => {
    const visibleSection = visibleSections.get(section.id);
    return collapsedIds.has(section.id) || visibleSection?.isSearchHidden;
  });

  function collapseSection(sectionId) {
    setCollapsedIds((current) => {
      if (current.has(sectionId)) return current;
      const next = new Set(current);
      next.add(sectionId);
      return next;
    });
  }

  function restoreSection(sectionId) {
    setCollapsedIds((current) => {
      if (!current.has(sectionId)) return current;
      const next = new Set(current);
      next.delete(sectionId);
      return next;
    });
  }

  return (
    <main className={`board${query ? " searching" : ""}`} data-app>
      <header className="masthead">
        <h1>{cheatSheet.title}</h1>
        <label aria-label={cheatSheet.search.label} className="search-wrap">
          <input
            autoComplete="off"
            className="drop-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={cheatSheet.search.placeholder}
            spellCheck="false"
            type="search"
            value={search}
          />
        </label>
      </header>

      <SearchStatus query={search.trim()} />

      <section aria-label="Featured reference panels" className="feature-grid" hidden={featureStackHidden}>
        {featureSections.map((section) => (
          <SectionRenderer
            key={section.id}
            collapsed={collapsedIds.has(section.id)}
            onCollapse={collapseSection}
            section={visibleSections.get(section.id)}
            topShelfItems={topShelfItems}
          />
        ))}
      </section>

      <section aria-label="Build and category cards" className="build-grid">
        {(cheatSheet.sections.main || []).map((section) => (
          <SectionRenderer
            key={section.id}
            collapsed={collapsedIds.has(section.id)}
            onCollapse={collapseSection}
            section={visibleSections.get(section.id)}
            topShelfItems={topShelfItems}
          />
        ))}
      </section>

      <section aria-label="Lower utility sections" className="utility-grid">
        {(cheatSheet.sections.lower || []).map((section) => (
          <SectionRenderer
            key={section.id}
            collapsed={collapsedIds.has(section.id)}
            onCollapse={collapseSection}
            section={visibleSections.get(section.id)}
            topShelfItems={topShelfItems}
          />
        ))}
      </section>

      <RestoreDock collapsedSections={collapsedSections} onRestore={restoreSection} />
    </main>
  );
}

function SearchStatus({ query }) {
  return (
    <p aria-live="polite" className="search-status">
      {query ? (
        <>
          Searching for <strong>{query}</strong>
        </>
      ) : null}
    </p>
  );
}

function SectionRenderer({ collapsed, onCollapse, section, topShelfItems }) {
  if (!section) return null;

  if (section.type === "caps") {
    return <CapsCard collapsed={collapsed} onCollapse={onCollapse} section={section} />;
  }

  if (section.type === "top-shelf") {
    return (
      <TopShelfCard
        collapsed={collapsed}
        onCollapse={onCollapse}
        section={section}
        topShelfItems={topShelfItems}
      />
    );
  }

  return (
    <BuildCard
      collapsed={collapsed}
      onCollapse={onCollapse}
      section={section}
      topShelfItems={topShelfItems}
    />
  );
}

function InteractiveSection({ children, className, collapsed, onCollapse, section }) {
  const accent = THEME_VAR[section.theme] || THEME_VAR.neutral;

  return (
    <section
      aria-labelledby={`${section.id}-title`}
      className={`${className}${section.isSearchHidden ? " search-hidden" : ""}`}
      hidden={collapsed}
      style={{ "--accent": accent }}
    >
      {children({ onCollapse: () => onCollapse(section.id) })}
    </section>
  );
}

function TopShelfCard({ collapsed, onCollapse, section }) {
  return (
    <InteractiveSection
      className="top-shelf"
      collapsed={collapsed}
      onCollapse={onCollapse}
      section={section}
    >
      {({ onCollapse: hideSection }) => (
        <>
          <header className="section-title">
            <h2 id={`${section.id}-title`}>{section.title}</h2>
            <CollapseButton onCollapse={hideSection} section={section} />
          </header>
          <div className="top-grid">
            {section.groups.map((group) => (
              <ItemGroup
                className="top-group"
                fallbackTheme={section.theme}
                group={group}
                key={group.title}
              />
            ))}
          </div>
        </>
      )}
    </InteractiveSection>
  );
}

function BuildCard({ collapsed, onCollapse, section, topShelfItems }) {
  const cardClasses = [
    "board-card",
    ...(section.classes || [])
  ].join(" ");

  return (
    <InteractiveSection
      className={cardClasses}
      collapsed={collapsed}
      onCollapse={onCollapse}
      section={section}
    >
      {({ onCollapse: hideSection }) => (
        <>
          <header className="card-head">
            <div className="card-title-row">
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              <CollapseButton onCollapse={hideSection} section={section} />
            </div>
            {section.description ? <p className="card-desc">{section.description}</p> : null}
          </header>
          <div className="card-groups">
            {section.groups.map((group) => (
              <ItemGroup
                fallbackTheme={section.theme}
                group={group}
                key={group.title}
                topShelfItems={topShelfItems}
              />
            ))}
          </div>
        </>
      )}
    </InteractiveSection>
  );
}

function ItemGroup({ className = "group", fallbackTheme, group, topShelfItems = new Set() }) {
  return (
    <div className={`${className}${group.isSearchHidden ? " search-hidden" : ""}`}>
      <h3>{group.title}</h3>
      <ul>
        {group.items.map((item) => {
          const value = item.value ?? item;
          const text = itemText(value);
          const styleName = itemStyle(value, fallbackTheme);
          const isTopPick = topShelfItems.has(text);
          const hidden = item.isSearchHidden ? " search-hidden" : "";
          const topPick = isTopPick ? " top-pick-match" : "";

          return (
            <li className={`item style-${styleName}${topPick}${hidden}`} key={text}>
              {text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CapsCard({ collapsed, onCollapse, section }) {
  return (
    <InteractiveSection
      className="board-card compact-card caps-card"
      collapsed={collapsed}
      onCollapse={onCollapse}
      section={section}
    >
      {({ onCollapse: hideSection }) => (
        <>
          <header className="card-head">
            <div className="card-title-row">
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              <CollapseButton onCollapse={hideSection} section={section} />
            </div>
          </header>
          <div className="caps-table-wrap">
            <CapsTable rows={section.rows} />
            {section.note ? <CapNote note={section.note} /> : null}
          </div>
        </>
      )}
    </InteractiveSection>
  );
}

function CollapseButton({ onCollapse, section }) {
  return (
    <button
      aria-label={`Hide ${section.title}`}
      className="collapse-button"
      onClick={onCollapse}
      title={`Hide ${section.title}`}
      type="button"
    >
      <span aria-hidden="true">-</span>
    </button>
  );
}

function CapsTable({ rows }) {
  return (
    <table className="caps-table">
      <thead>
        <tr>
          <th scope="col">Attribute</th>
          <th scope="col">Use</th>
          <th scope="col">Breakpoints</th>
          <th scope="col">Note</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr className={row.isSearchHidden ? " search-hidden" : ""} key={`${row.attribute}-${row.use}`}>
            <th data-label="Attribute" scope="row">
              <span className="cap-attribute">{row.attribute}</span>
              <small>{row.metric}</small>
            </th>
            <td data-label="Use">{row.use}</td>
            <td data-label="Breakpoints">
              <span className="cap-breakpoints">
                {(row.breakpoints || []).map((breakpoint) => (
                  <span className="cap-chip" key={breakpoint}>{breakpoint}</span>
                ))}
              </span>
            </td>
            <td data-label="Note" className={`cap-note-cell${row.note ? "" : " cap-note-empty"}`}>
              {row.note || ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CapNote({ note }) {
  return (
    <div className={`cap-note${note.isSearchHidden ? " search-hidden" : ""}`}>
      <h3>{note.title}</h3>
      {note.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function RestoreDock({ collapsedSections, onRestore }) {
  return (
    <nav aria-label="Collapsed sections" className="collapse-dock" hidden={collapsedSections.length === 0}>
      <div className="dock-track">
        {collapsedSections.map((section) => (
          <button
            aria-label={`Restore ${section.title}`}
            className="dock-button"
            key={section.id}
            onClick={() => onRestore(section.id)}
            style={{ "--accent": THEME_VAR[section.theme] || THEME_VAR.neutral }}
            title={`Restore ${section.title}`}
            type="button"
          >
            {section.abbrev}
          </button>
        ))}
      </div>
    </nav>
  );
}

export default App;
