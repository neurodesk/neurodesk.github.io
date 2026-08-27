import { useState, useMemo, useEffect } from "react";

interface AppListEntry {
  application: string;
  categories: string[];
  doi?: string;
  doi_url?: string;
  license?: string;
  description?: string;
  openrecon?: boolean;
}

interface AppVersion {
  version: string;
  buildDate: string;
  doi?: string;
  doiUrl?: string;
  license?: string;
}

interface GroupedApp {
  name: string;
  description?: string;
  categories: string[];
  versions: AppVersion[];
  openrecon: boolean;
}

function parseApplication(entry: AppListEntry): {
  name: string;
  version: string;
  buildDate: string;
} {
  const parts = entry.application.split("_");

  // Format: name_version_YYYYMMDD — last 2 segments are version and build date
  if (parts.length >= 3) {
    const buildDateRaw = parts[parts.length - 1];
    const version = parts[parts.length - 2];
    const name = parts.slice(0, parts.length - 2).join("_");
    const buildDate = formatDate(buildDateRaw);
    return { name, version, buildDate };
  }
  return { name: entry.application, version: "", buildDate: "" };
}

function formatDate(raw: string): string {
  if (raw.length === 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

function groupApps(entries: AppListEntry[]): GroupedApp[] {
  const map = new Map<string, GroupedApp>();

  for (const entry of entries) {
    const { name, version, buildDate } = parseApplication(entry);
    const existing = map.get(name);

    const versionEntry: AppVersion = {
      version,
      buildDate,
      doi: entry.doi,
      doiUrl: entry.doi_url,
      license: entry.license,
    };

    if (existing) {
      existing.versions.push(versionEntry);
      if (entry.openrecon) existing.openrecon = true;
      // Merge categories
      for (const cat of entry.categories) {
        if (!existing.categories.includes(cat)) {
          existing.categories.push(cat);
        }
      }
    } else {
      map.set(name, {
        name,
        description: entry.description,
        categories: [...entry.categories],
        versions: [versionEntry],
        openrecon: !!entry.openrecon,
      });
    }
  }

  // Sort versions within each app by build date (newest first)
  for (const app of map.values()) {
    app.versions.sort((a, b) => b.buildDate.localeCompare(a.buildDate));
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ab-detail-row">
      <span className="ab-detail-label">{label}</span>
      <div className="ab-detail-content">{children}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="ab-badge">{children}</span>;
}

function AppCard({ app }: { app: GroupedApp }) {
  const [expanded, setExpanded] = useState(false);
  const latestVersion = app.versions[0];
  const hasMultiple = app.versions.length > 1;
  // Collect any license from the versions (they typically share the same license)
  const license = app.versions.find((v) => v.license)?.license;

  return (
    <div className="ab-card">
      <div className="ab-card-header">
        <div className="ab-card-title-row">
          <h3 className="ab-card-title">{app.name}</h3>
          {app.openrecon && (
            <span className="ab-badge ab-badge--openrecon">OpenRecon</span>
          )}
        </div>
        <span className="ab-version-count">
          {app.versions.length} version{app.versions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="ab-card-body">
        {app.description && <p className="ab-card-desc">{app.description}</p>}

        <DetailRow label="Categories">
          <div className="ab-badge-list">
            {app.categories.length > 0 ? (
              app.categories.map((cat) => <Badge key={cat}>{cat}</Badge>)
            ) : (
              <span className="ab-muted">N/A</span>
            )}
          </div>
        </DetailRow>

        {license && (
          <DetailRow label="License">
            <Badge>{license}</Badge>
          </DetailRow>
        )}

        <DetailRow label="Latest Version">
          <div className="ab-version-row">
            <span className="ab-version-num">{latestVersion.version}</span>
            <span className="ab-muted">({latestVersion.buildDate})</span>
            {latestVersion.doiUrl && (
              <a
                href={latestVersion.doiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ab-doi-link"
              >
                DOI
              </a>
            )}
          </div>
        </DetailRow>

        {hasMultiple && (
          <DetailRow label="All Versions">
            <button
              className="ab-expand-btn"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide" : "Show"} {app.versions.length} versions
              <svg
                className={`ab-chevron ${expanded ? "ab-chevron--open" : ""}`}
                width="12"
                height="12"
                viewBox="0 0 12 12"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {expanded && (
              <div className="ab-versions-list">
                {app.versions.map((v) => (
                  <div key={v.version + v.buildDate} className="ab-version-row">
                    <span className="ab-version-num">{v.version}</span>
                    <span className="ab-muted">({v.buildDate})</span>
                    {v.doiUrl && (
                      <a
                        href={v.doiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ab-doi-link"
                      >
                        DOI
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DetailRow>
        )}
      </div>
    </div>
  );
}

export default function ApplicationsBrowser() {
  const [entries, setEntries] = useState<AppListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [openreconOnly, setOpenreconOnly] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/applist.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setEntries(data.list || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const grouped = useMemo(() => groupApps(entries), [entries]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const app of grouped) {
      for (const cat of app.categories) {
        cats.add(cat);
      }
    }
    return Array.from(cats).sort();
  }, [grouped]);

  const filtered = useMemo(() => {
    return grouped.filter((app) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          app.name,
          app.description || "",
          ...app.categories,
          ...app.versions.map((v) => v.version),
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      if (selectedCategories.length > 0) {
        if (!app.categories.some((c) => selectedCategories.includes(c))) {
          return false;
        }
      }

      if (openreconOnly && !app.openrecon) return false;

      return true;
    });
  }, [grouped, searchQuery, selectedCategories, openreconOnly]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  if (loading) {
    return <div className="ab-status">Loading applications...</div>;
  }

  if (error) {
    return (
      <div className="ab-status ab-status--error">
        Failed to load applications: {error}
      </div>
    );
  }

  return (
    <div className="ab-browser">
      <div className="ab-toolbar">
        <div className="ab-search-wrap">
          <svg
            className="ab-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            className="ab-search"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="ab-result-count">
          {filtered.length} of {grouped.length} applications
        </div>
      </div>

      <div className="ab-layout">
        <>
          <aside className="ab-sidebar">
            <div className="ab-filter-header">
              <strong>Container type</strong>
            </div>
            <div className="ab-filter-section">
              <label className="ab-filter-item">
                <input
                  type="checkbox"
                  checked={openreconOnly}
                  onChange={() => setOpenreconOnly((v) => !v)}
                />
                <div className="ab-openrecon-badge">
                  <span className="ab-badge ab-badge--openrecon">
                    OpenRecon
                  </span>
                  <div className="tooltip">
                    &#9432;
                    <span className="tooltiptext">Runs on MRI scanners</span>
                  </div>
                </div>
              </label>
            </div>
            <div className="ab-filter-header">
              <strong>Categories</strong>
              {selectedCategories.length > 0 && (
                <button
                  className="ab-clear-btn"
                  onClick={() => setSelectedCategories([])}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="ab-filter-list">
              {allCategories.map((cat) => (
                <label key={cat} className="ab-filter-item">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                  />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
          </aside>
          <div className="ab-grid">
            <div className="ab-grid-toolbar">
              <h3 className="ab-grid-toolbar-count">{filtered.length} Tools</h3>
              <a
                href="/developers/new-tools/"
                className="add-tool-button"
                target="_blank"
                rel="noopener noreferrer"
              >
                Build new tool
              </a>
            </div>
            {filtered.map((app) => (
              <AppCard key={app.name} app={app} />
            ))}
            {filtered.length === 0 && (
              <div className="ab-empty">
                <p>No applications match your criteria.</p>
                <button
                  className="ab-clear-btn"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategories([]);
                    setOpenreconOnly(false);
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </>
      </div>
    </div>
  );
}
