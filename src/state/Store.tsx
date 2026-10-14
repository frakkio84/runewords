import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildPilotCatalog, resyncPilotCatalog } from '../data/buildPilotCatalog';
import { submitClaim } from '../domain/claims/claims';
import type { Catalog, Profile } from '../domain/catalog';
import { submitContribution, withdrawContribution } from '../domain/contributions/contributions';
import type { ImportReport } from '../domain/import/importPlaces';

const STORAGE_KEY = 'orari-commerciali.v1';

export type SearchFilters = {
  text: string;
  category: string | null;
  openNow: boolean;
  mode: 'city' | 'point';
  radiusMeters: number;
  center: { latitude: number; longitude: number; label: string } | null;
};

type Persisted = { catalog: Catalog; userId: string | null };

type WithoutUserId<T> = T extends unknown ? Omit<T, 'userId'> : never;

type StoreValue = {
  catalog: Catalog;
  userId: string | null;
  profile: Profile | null;
  filters: SearchFilters;
  setFilters: (patch: Partial<SearchFilters>) => void;
  importReport: ImportReport | null;
  syncing: boolean;
  ensureUser: (displayName: string) => { ok: true; userId: string } | { ok: false; message: string };
  renameUser: (displayName: string) => { ok: true } | { ok: false; message: string };
  submitAs: (
    displayName: string,
    input: WithoutUserId<Parameters<typeof submitContribution>[1]>,
  ) => { ok: true; message: string } | { ok: false; message: string };
  withdraw: (contributionId: string) => { ok: true; message: string } | { ok: false; message: string };
  claimAs: (
    displayName: string,
    input: Omit<Parameters<typeof submitClaim>[1], 'userId'>,
  ) => { ok: true; message: string } | { ok: false; message: string };
  resync: () => Promise<{ ok: true; report: ImportReport } | { ok: false; message: string }>;
};

const StoreContext = createContext<StoreValue | null>(null);

function freshState(): Persisted {
  return { catalog: buildPilotCatalog(new Date()), userId: null };
}

function sanitize(catalog: Catalog): Catalog {
  return {
    ...catalog,
    profiles: catalog.profiles.map((profile) =>
      profile.id === 'mod-pilot' ? profile : { ...profile, role: 'user' },
    ),
  };
}

function loadState(): Persisted {
  if (typeof localStorage === 'undefined') return freshState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed.catalog?.cities?.some((city) => city.id === 'bologna')) return freshState();
    if (!Array.isArray(parsed.catalog.businesses) || parsed.catalog.businesses.length === 0) {
      return freshState();
    }
    return { catalog: sanitize(parsed.catalog), userId: parsed.userId };
  } catch {
    return freshState();
  }
}

const INITIAL_FILTERS: SearchFilters = {
  text: '',
  category: null,
  openNow: false,
  mode: 'city',
  radiusMeters: 2000,
  center: null,
};

function newId(): string {
  return globalThis.crypto.randomUUID();
}

function prepareUser(
  persisted: Persisted,
  displayName: string,
): { ok: true; userId: string; catalog: Catalog } | { ok: false; message: string } {
  const name = displayName.trim();
  if (name.length < 2) return { ok: false, message: 'Indica un nome di almeno 2 caratteri.' };
  const clipped = name.slice(0, 40);
  if (persisted.userId && persisted.catalog.profiles.some((profile) => profile.id === persisted.userId)) {
    return {
      ok: true,
      userId: persisted.userId,
      catalog: {
        ...persisted.catalog,
        profiles: persisted.catalog.profiles.map((profile) =>
          profile.id === persisted.userId ? { ...profile, displayName: clipped } : profile,
        ),
      },
    };
  }
  const userId = newId();
  return {
    ok: true,
    userId,
    catalog: {
      ...persisted.catalog,
      profiles: [
        ...persisted.catalog.profiles,
        {
          id: userId,
          displayName: clipped,
          role: 'user',
          reputationScore: 0,
          createdAt: new Date().toISOString(),
        },
      ],
    },
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [persisted, setPersisted] = useState<Persisted>(loadState);
  const [filters, setFilterState] = useState<SearchFilters>(INITIAL_FILTERS);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }, [persisted]);

  const value = useMemo<StoreValue>(() => {
    const profile = persisted.catalog.profiles.find((item) => item.id === persisted.userId) ?? null;
    return {
      catalog: persisted.catalog,
      userId: persisted.userId,
      profile,
      filters,
      setFilters: (patch) => setFilterState((current) => ({ ...current, ...patch })),
      importReport,
      syncing,
      ensureUser: (displayName) => {
        const name = displayName.trim();
        if (name.length < 2) return { ok: false, message: 'Indica un nome di almeno 2 caratteri.' };
        if (persisted.userId && profile) {
          setPersisted((current) => ({
            ...current,
            catalog: {
              ...current.catalog,
              profiles: current.catalog.profiles.map((item) =>
                item.id === current.userId ? { ...item, displayName: name.slice(0, 40) } : item,
              ),
            },
          }));
          return { ok: true, userId: persisted.userId };
        }
        const userId = newId();
        const created: Profile = {
          id: userId,
          displayName: name.slice(0, 40),
          role: 'user',
          reputationScore: 0,
          createdAt: new Date().toISOString(),
        };
        setPersisted((current) => ({
          userId,
          catalog: { ...current.catalog, profiles: [...current.catalog.profiles, created] },
        }));
        return { ok: true, userId };
      },
      renameUser: (displayName) => {
        const name = displayName.trim();
        if (!persisted.userId) return { ok: false, message: 'Nessun profilo su questo dispositivo.' };
        if (name.length < 2) return { ok: false, message: 'Il nome deve avere almeno 2 caratteri.' };
        setPersisted((current) => ({
          ...current,
          catalog: {
            ...current.catalog,
            profiles: current.catalog.profiles.map((item) =>
              item.id === current.userId ? { ...item, displayName: name.slice(0, 40) } : item,
            ),
          },
        }));
        return { ok: true };
      },
      submitAs: (displayName, input) => {
        const prepared = prepareUser(persisted, displayName);
        if (!prepared.ok) return prepared;
        const result = submitContribution(
          prepared.catalog,
          { ...input, userId: prepared.userId },
          { now: new Date(), id: newId },
        );
        if (!result.ok) return result;
        setPersisted({ userId: prepared.userId, catalog: result.catalog });
        if (input.type === 'status_confirmation') {
          return {
            ok: true,
            message: 'Conferma registrata. Gli orari settimanali pubblicati non sono stati modificati.',
          };
        }
        return {
          ok: true,
          message: 'Proposta registrata come in attesa. Gli orari pubblicati restano invariati finché non viene approvata.',
        };
      },
      withdraw: (contributionId) => {
        if (!persisted.userId) return { ok: false, message: 'Nessun profilo su questo dispositivo.' };
        const result = withdrawContribution(
          persisted.catalog,
          { contributionId, userId: persisted.userId },
          { now: new Date(), id: newId },
        );
        if (!result.ok) return result;
        setPersisted((current) => ({ ...current, catalog: result.catalog }));
        return { ok: true, message: 'Contributo ritirato. I dati pubblicati non cambiano.' };
      },
      claimAs: (displayName, input) => {
        const prepared = prepareUser(persisted, displayName);
        if (!prepared.ok) return prepared;
        const result = submitClaim(
          prepared.catalog,
          { ...input, userId: prepared.userId },
          { now: new Date(), id: newId },
        );
        if (!result.ok) return result;
        setPersisted({ userId: prepared.userId, catalog: result.catalog });
        return {
          ok: true,
          message: 'Richiesta registrata. Non concede permessi di gestione finché non è verificata.',
        };
      },
      resync: async () => {
        setSyncing(true);
        try {
          const result = await resyncPilotCatalog(persisted.catalog, new Date());
          setPersisted((current) => ({ ...current, catalog: result.catalog }));
          setImportReport(result.report);
          return { ok: true, report: result.report };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Aggiornamento non riuscito.';
          return { ok: false, message };
        } finally {
          setSyncing(false);
        }
      },
    };
  }, [filters, importReport, persisted, syncing]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('Store mancante.');
  return value;
}
