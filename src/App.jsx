import { useMemo, useState } from "react";
import cheatSheet from "../data/cheat-sheet.json";

const THEME_VAR = {
  "top-shelf": "var(--c-top-shelf)",
  neutral: "var(--c-neutral)",
  quality: "var(--c-quality)",
  strength: "var(--c-strength)",
  dexterity: "var(--c-dexterity)",
  sorcerer: "var(--c-sorcerer)",
  pyromancer: "var(--c-pyromancer)",
  miracle: "var(--c-miracle)",
  "dark-melee": "var(--c-dark-melee)",
  "bleed-luck": "var(--c-bleed-luck)",
  "hollow-luck": "var(--c-hollow-luck)",
  "battle-mage": "var(--c-battle-mage)",
  paladin: "var(--c-paladin)",
  "glass-cannon": "var(--c-glass-cannon)",
  armor: "var(--c-armor)",
  consumables: "var(--c-consumables)",
  caps: "var(--c-caps)"
};

const WEAPON_PREFIXES = [
  "refined",
  "heavy",
  "sharp",
  "crystal",
  "chaos",
  "dark",
  "lightning",
  "blessed",
  "hollow",
  "simple",
  "raw",
  "fire",
  "deep",
  "poison",
  "blood"
];

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeWeaponName(value) {
  return normalizeText(value)
    .replace(/\s*\(dlc\)\s*/g, " ")
    .replace(/\s\+\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function baseWeaponName(value) {
  const name = normalizeWeaponName(value);
  const prefix = WEAPON_PREFIXES.find((current) => name.startsWith(`${current} `));

  return prefix ? name.slice(prefix.length + 1) : name;
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
    row.use,
    ...(row.breakpoints || [])
  ].filter(Boolean).join(" ");
}

function getVisibleNote(note, query) {
  if (!note) return null;

  return {
    ...note,
    isSearchHidden: !normalizeText(
      [note.title, ...(note.lines || [])].join(" ")
    ).includes(query)
  };
}

function groupCapRows(rows) {
  return rows.reduce((groups, row) => {
    const group = groups.find((current) => current.attribute === row.attribute);

    if (group) {
      group.rows.push(row);
      group.isSearchHidden = group.rows.every((entry) => entry.isSearchHidden);
      return groups;
    }

    groups.push({
      attribute: row.attribute,
      rows: [row],
      isSearchHidden: row.isSearchHidden
    });

    return groups;
  }, []);
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
    const note = getVisibleNote(section.note, query);
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
  const note = getVisibleNote(section.note, query);
  const hasVisibleEntry = groups.some((group) => !group.isSearchHidden) || (note && !note.isSearchHidden);

  return { ...section, groups, note, isSearchHidden: !hasVisibleEntry };
}

function buildTopShelfWeaponSet(sections) {
  const topShelfItems = sections
    .filter((section) => section.type === "top-shelf")
    .flatMap((section) => section.groups || [])
    .filter((group) => normalizeText(group.title) === "the goats")
    .flatMap((group) => group.items.map((item) => normalizeWeaponName(itemText(item))));

  return new Set(topShelfItems);
}

function buildItemThemeMap(sections) {
  const itemThemes = new Map();

  function addItemTheme(key, theme) {
    if (!key) return;
    const themes = itemThemes.get(key) || new Set();
    themes.add(theme);
    itemThemes.set(key, themes);
  }

  sections.forEach((section) => {
    (section.groups || []).forEach((group) => {
      (group.items || []).forEach((item) => {
        const text = itemText(item);
        addItemTheme(normalizeWeaponName(text), section.theme);
        addItemTheme(baseWeaponName(text), section.theme);
      });
    });
  });

  return itemThemes;
}

function getUniqueBuildTheme(itemThemes, text) {
  const themes = new Set([
    ...(itemThemes.get(normalizeWeaponName(text)) || []),
    ...(itemThemes.get(baseWeaponName(text)) || [])
  ]);

  return themes.size === 1 ? [...themes][0] : null;
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
  const topShelfWeapons = useMemo(() => buildTopShelfWeaponSet(cheatSheet.sections.feature || []), []);
  const itemBuildThemes = useMemo(() => buildItemThemeMap(cheatSheet.sections.main || []), []);
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
            itemBuildThemes={itemBuildThemes}
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
            topShelfWeapons={topShelfWeapons}
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

function SectionRenderer({ collapsed, itemBuildThemes, onCollapse, section, topShelfWeapons }) {
  if (!section) return null;

  if (section.type === "caps") {
    return <CapsCard collapsed={collapsed} onCollapse={onCollapse} section={section} />;
  }

  if (section.type === "top-shelf") {
    return (
      <TopShelfCard
        collapsed={collapsed}
        itemBuildThemes={itemBuildThemes}
        onCollapse={onCollapse}
        section={section}
        topShelfWeapons={topShelfWeapons}
      />
    );
  }

  return (
    <BuildCard
      collapsed={collapsed}
      onCollapse={onCollapse}
      section={section}
      topShelfWeapons={topShelfWeapons}
    />
  );
}

function InteractiveSection({ children, className, collapsed, onCollapse, section }) {
  const accent = THEME_VAR[section.theme] || THEME_VAR.neutral;
  const collapseCurrentSection = () => onCollapse(section.id);

  function handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    collapseCurrentSection();
  }

  return (
    <section
      aria-label={`Hide ${section.title}`}
      aria-labelledby={`${section.id}-title`}
      className={`${className}${section.isSearchHidden ? " search-hidden" : ""}`}
      hidden={collapsed}
      onClick={collapseCurrentSection}
      onKeyDown={handleKeyDown}
      style={{ "--accent": accent }}
      tabIndex="0"
      title={`Hide ${section.title}`}
    >
      {children}
    </section>
  );
}

function TopShelfCard({ collapsed, itemBuildThemes, onCollapse, section }) {
  return (
    <InteractiveSection
      className="top-shelf"
      collapsed={collapsed}
      onCollapse={onCollapse}
      section={section}
    >
      <header className="section-title">
        <h2 id={`${section.id}-title`}>{section.title}</h2>
      </header>
      <div className="top-grid">
        {section.groups.map((group) => (
          <ItemGroup
            className="top-group"
            fallbackTheme={section.theme}
            group={group}
            itemBuildThemes={itemBuildThemes}
            key={group.title}
          />
        ))}
      </div>
      {section.note ? <SectionNote className="top-shelf-note" note={section.note} /> : null}
    </InteractiveSection>
  );
}

function BuildCard({ collapsed, onCollapse, section, topShelfWeapons }) {
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
      <header className="card-head">
        <div className="card-title-row">
          <div className="build-title-lockup">
            {section.abbrev ? <span className="build-badge">{section.abbrev}</span> : null}
            <h2 id={`${section.id}-title`}>{section.title}</h2>
          </div>
        </div>
        {section.description ? <p className="card-desc">{section.description}</p> : null}
      </header>
      <div className="card-groups">
        {section.groups.map((group) => (
          <ItemGroup
            fallbackTheme={section.theme}
            group={group}
            key={group.title}
            topShelfWeapons={topShelfWeapons}
          />
        ))}
      </div>
    </InteractiveSection>
  );
}

function ItemGroup({ className = "group", fallbackTheme, group, itemBuildThemes, topShelfWeapons = new Set() }) {
  return (
    <div className={`${className}${group.isSearchHidden ? " search-hidden" : ""}`}>
      <h3>{group.title}</h3>
      <ul>
        {group.items.map((item) => {
          const value = item.value ?? item;
          const text = itemText(value);
          const styleName = itemStyle(value, fallbackTheme);
          const isTopShelfWeapon = topShelfWeapons.has(normalizeWeaponName(text)) || topShelfWeapons.has(baseWeaponName(text));
          const hidden = item.isSearchHidden ? " search-hidden" : "";
          const topShelfWeapon = isTopShelfWeapon ? " top-shelf-weapon-match" : "";
          const buildTheme = itemBuildThemes ? getUniqueBuildTheme(itemBuildThemes, text) : null;
          const buildThemeColor = buildTheme ? THEME_VAR[buildTheme] : null;

          return (
            <li
              className={`item style-${styleName}${topShelfWeapon}${buildTheme ? " top-build-theme-match" : ""}${hidden}`}
              key={text}
              style={buildThemeColor ? { "--item-build-color": buildThemeColor } : undefined}
            >
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
      <header className="card-head">
        <div className="card-title-row">
          <h2 id={`${section.id}-title`}>{section.title}</h2>
        </div>
      </header>
      <div className="caps-table-wrap">
        <CapsTable rows={section.rows} />
        {section.note ? <SectionNote className="cap-note" note={section.note} /> : null}
      </div>
    </InteractiveSection>
  );
}

function CapsTable({ rows }) {
  const groupedRows = groupCapRows(rows);

  return (
    <table className="caps-table">
      <colgroup>
        <col className="cap-attribute-col" />
        <col className="cap-use-col" />
        <col className="cap-breakpoints-col" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Attribute</th>
          <th scope="col">Use</th>
          <th scope="col">Soft Caps</th>
        </tr>
      </thead>
      <tbody>
        {groupedRows.map((group) => (
          <tr className={group.isSearchHidden ? " search-hidden" : ""} key={group.attribute}>
            <th data-label="Attribute" scope="row">
              <span className="cap-attribute">{group.attribute}</span>
            </th>
            <td colSpan="2" data-label="Uses">
              <div className="cap-uses">
                {group.rows.map((row) => (
                  <div
                    className={`cap-use-row${row.isSearchHidden ? " search-hidden" : ""}`}
                    key={`${row.attribute}-${row.use}`}
                  >
                    <div className="cap-use">
                      <span>{row.use}</span>
                    </div>
                    <span className="cap-breakpoints">
                      {(row.breakpoints || []).map((breakpoint) => (
                        <span className="cap-chip" key={breakpoint}>{breakpoint}</span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SectionNote({ className, note }) {
  return (
    <div className={`${className}${note.isSearchHidden ? " search-hidden" : ""}`}>
      <h3>{note.title}</h3>
      <div className="note-lines">
        {note.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
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
