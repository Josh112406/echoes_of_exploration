import { useEffect, useRef, useState } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';

export type RoutePath = '/' | '/archive' | '/sources' | '/game';
export type ArchiveSubView = 'missions' | 'realms' | 'evidence';
export type SourcesSubView = 'registry' | 'references' | 'methodology';

interface DropdownOption {
  id: ArchiveSubView | SourcesSubView;
  route: '/archive' | '/sources';
  href: string;
  label: string;
  desc: string;
}

const ARCHIVE_MENU_OPTIONS: DropdownOption[] = [
  {
    id: 'missions',
    route: '/archive',
    href: '/archive/',
    label: 'Mission Archives Catalog (31)',
    desc: 'Filterable catalog of NASA spacecraft across Moon, Mars & Deep Space',
  },
  {
    id: 'realms',
    route: '/archive',
    href: '/archive/?view=realms',
    label: 'Three Realms & Discovery Bridges (3)',
    desc: 'Chapter overviews for Moon, Mars & Elsewhere exploration bridges',
  },
  {
    id: 'evidence',
    route: '/archive',
    href: '/archive/?view=evidence',
    label: 'Encounter Evidence Chains (9)',
    desc: 'Learning intents, observation chains & simplification notes',
  },
  {
    id: 'registry',
    route: '/sources',
    href: '/sources/',
    label: 'Primary NASA Sources Registry (33)',
    desc: 'Verified NASA, JPL, NSSDCA, ILRS & PDS authority citations',
  },
  {
    id: 'references',
    route: '/sources',
    href: '/sources/?view=references',
    label: 'Encounter Science References (6)',
    desc: 'Key NASA instrument & telemetry parameter bibliographies',
  },
  {
    id: 'methodology',
    route: '/sources',
    href: '/sources/?view=methodology',
    label: 'Two-Voice Rule, Glossary & Save Data',
    desc: 'Story vs verified record standard, Space Apps compliance & JSON save',
  },
];

interface SourcesArchiveDropdownProps {
  routePath: RoutePath;
  archiveSubView: ArchiveSubView;
  sourcesSubView: SourcesSubView;
  alignRight?: boolean;
  onSelectArchive: (view: ArchiveSubView) => void;
  onSelectSources: (view: SourcesSubView) => void;
}

/** Accessible dropdown linking directly to dedicated /archive and /sources subdirectories. */
export function SourcesArchiveDropdown({
  routePath,
  archiveSubView,
  sourcesSubView,
  alignRight = false,
  onSelectArchive,
  onSelectSources,
}: SourcesArchiveDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSelect = (item: DropdownOption) => {
    telemetryAudio.playChirp(860, 0.03);
    setOpen(false);
    if (item.route === '/archive') {
      onSelectArchive(item.id as ArchiveSubView);
    } else {
      onSelectSources(item.id as SourcesSubView);
    }
  };

  return (
    <div className="archive-dropdown" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn-secondary btn-sm dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          telemetryAudio.playChirp(840, 0.03);
          setOpen((v) => !v);
        }}
      >
        <span>SOURCES &amp; ARCHIVES</span>
        <span aria-hidden="true">{open ? '▲' : '▾'}</span>
      </button>

      {open && (
        <div
          className={`dropdown-menu ${alignRight ? 'dropdown-menu--right' : ''}`}
          role="menu"
          aria-label="Sources and Archives Menu"
        >
          <div className="dropdown-group-label">MISSION ARCHIVES (/archive)</div>
          {ARCHIVE_MENU_OPTIONS.filter((i) => i.route === '/archive').map((item) => (
            <a
              key={item.id}
              href={item.href}
              role="menuitem"
              className={`dropdown-item ${routePath === '/archive' && archiveSubView === item.id ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
            >
              <div>
                <span className="dropdown-item-title">{item.label}</span>
                <span className="dropdown-item-sub">{item.desc}</span>
              </div>
              <span className="mono" style={{ color: 'var(--cyan)', fontSize: '12px' }}>
                →
              </span>
            </a>
          ))}

          <div className="dropdown-group-label">PRIMARY NASA SOURCES (/sources)</div>
          {ARCHIVE_MENU_OPTIONS.filter((i) => i.route === '/sources').map((item) => (
            <a
              key={item.id}
              href={item.href}
              role="menuitem"
              className={`dropdown-item ${routePath === '/sources' && sourcesSubView === item.id ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
            >
              <div>
                <span className="dropdown-item-title">{item.label}</span>
                <span className="dropdown-item-sub">{item.desc}</span>
              </div>
              <span className="mono" style={{ color: 'var(--amber)', fontSize: '12px' }}>
                →
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
