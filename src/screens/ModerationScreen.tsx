import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
} from "react";

import type {
  ModerationPlayerDto,
  ModerationPlayerListQuery,
  ModerationPlayerPageDto,
  ModerationStateDto,
} from "../api/types";
import AppButton from "../components/AppButton";
import GiftCodeAdminPanel from "../components/GiftCodeAdminPanel";
import DirectMessageReportsPanel from "../components/DirectMessageReportsPanel";
import RoleAdminPanel from "../components/admin/RoleAdminPanel";
import CharacterAdminPanel from "../components/admin/CharacterAdminPanel";
import BannerAdminPanel from "../components/admin/BannerAdminPanel";
import EventAdminPanel from "../components/admin/EventAdminPanel";
import GlobalChatReportsPanel from "../components/admin/GlobalChatReportsPanel";
import AdminAuditPanel from "../components/admin/AdminAuditPanel";
import ModerationPlayerBrowser from "../components/ModerationPlayerBrowser";
import GiveawayAdminPanel from "../components/GiveawayAdminPanel";
import PlayerIdentityInline from "../components/PlayerIdentityInline";
import ScrollableScreenPanel from "../components/ScrollableScreenPanel";
import type {
  ModerationGachaInput,
  ModerationResourceInput,
  ModerationXpInput,
} from "../moderation/moderation-intent-coordinator";
import { apiErrorMessage, formatResourceAmount } from "../utils/formatters";

type Props = {
  actorPlayerId: string;
  capabilities: ModerationStateDto["permissions"]["capabilities"];
  onLoad: (targetPlayerId?: string) => Promise<ModerationStateDto>;
  onListPlayers: (
    query: ModerationPlayerListQuery,
  ) => Promise<ModerationPlayerPageDto>;
  onResource: (
    targetPlayerId: string,
    input: ModerationResourceInput,
  ) => Promise<ModerationStateDto>;
  onXp: (
    targetPlayerId: string,
    input: ModerationXpInput,
  ) => Promise<ModerationStateDto>;
  onGacha: (
    targetPlayerId: string,
    input: ModerationGachaInput,
  ) => Promise<ModerationStateDto>;
  onStella: (
    targetPlayerId: string,
    quantity: string,
  ) => Promise<ModerationStateDto>;
  onApplied: (state: ModerationStateDto) => void;
  onLoadGiftCodes?: ComponentProps<typeof GiftCodeAdminPanel>["onLoad"];
  onCreateGiftCode?: ComponentProps<typeof GiftCodeAdminPanel>["onCreate"];
  onPublishGiftCode?: ComponentProps<typeof GiftCodeAdminPanel>["onPublish"];
  onUpdateGiftCode?: ComponentProps<typeof GiftCodeAdminPanel>["onUpdate"];
  onGiftCodeClaimants?: ComponentProps<
    typeof GiftCodeAdminPanel
  >["onClaimants"];
};

const resources = [
  ["primogems", "Primos"],
  ["moras", "Moras"],
  ["particles_pyro", "Pyro"],
  ["particles_hydro", "Hydro"],
  ["particles_cryo", "Cryo"],
  ["particles_electro", "Electro"],
  ["particles_anemo", "Anémo"],
  ["particles_geo", "Géo"],
  ["particles_dendro", "Dendro"],
] as const;
const moderationRankLabels = {
  SUPER: "Super",
  MODERATOR: "Modérateur",
  TESTER: "Testeur",
  PLAYER: "Joueur",
} as const;
const integerText = (value: string) => value.replace(/[^0-9]/g, "");

function ModerationScreen({
  actorPlayerId,
  capabilities,
  onLoad,
  onListPlayers,
  onResource,
  onXp,
  onGacha,
  onStella,
  onApplied,
  onLoadGiftCodes,
  onCreateGiftCode,
  onPublishGiftCode,
  onUpdateGiftCode,
  onGiftCodeClaimants,
}: Props) {
  const [state, setState] = useState<ModerationStateDto | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState(actorPlayerId);
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<readonly ModerationPlayerDto[]>([]);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [communityType, setCommunityType] = useState<'chat' | 'dm'>('dm');
  const [resourceKey, setResourceKey] = useState("primogems");
  const [amount, setAmount] = useState("160");
  const [xp, setXp] = useState("");
  const [pity5, setPity5] = useState("");
  const [pity4, setPity4] = useState("");
  const [capture, setCapture] = useState("");
  const [guarantee, setGuarantee] = useState(false);
  const [stella, setStella] = useState("0");
  const systemAvailable =
    capabilities.selfResourceTools ||
    capabilities.selfGameplayTools ||
    capabilities.superTools;
  const [pending, setPending] = useState(systemAvailable);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"system" | "characters" | "codes" | "banners" | "events" | "community" | "giveaway" | "audit">(
    () => (systemAvailable ? "system" : "community"),
  );
  const onLoadRef = useRef(onLoad);
  const onAppliedRef = useRef(onApplied);
  const systemTabRef = useRef<HTMLButtonElement>(null);
  const codesTabRef = useRef<HTMLButtonElement>(null);
  const charactersTabRef = useRef<HTMLButtonElement>(null);
  const bannersTabRef = useRef<HTMLButtonElement>(null);
  const eventsTabRef = useRef<HTMLButtonElement>(null);
  const auditTabRef = useRef<HTMLButtonElement>(null);
  const communityTabRef = useRef<HTMLButtonElement>(null);
  const giveawayTabRef = useRef<HTMLButtonElement>(null);
  const requestRevision = useRef(0);
  const isSuper = capabilities.superTools;
  const isSelf = selectedTargetId === actorPlayerId;
  const canUseGameplayTools = capabilities.selfGameplayTools || isSuper;
  const currentResource = moderationResourceCurrent(state, resourceKey);
  const codesAvailable = Boolean(
    isSuper &&
    onLoadGiftCodes &&
    onCreateGiftCode &&
    onPublishGiftCode &&
    onUpdateGiftCode &&
    onGiftCodeClaimants,
  );
  const availableTabs = [
    ...(systemAvailable ? (['system'] as const) : []),
    ...(isSuper ? (['characters'] as const) : []),
    ...(codesAvailable ? (['codes'] as const) : []),
    ...(isSuper ? (['banners', 'events'] as const) : []),
    ...(capabilities.communityModeration ? (['community', 'giveaway'] as const) : []),
    ...(isSuper ? (['audit'] as const) : []),
  ];

  useEffect(() => {
    if (availableTabs.length && !availableTabs.includes(activeTab)) setActiveTab(availableTabs[0]!);
  }, [activeTab, systemAvailable, isSuper, codesAvailable, capabilities.communityModeration]);

  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);
  useEffect(() => {
    onAppliedRef.current = onApplied;
  }, [onApplied]);

  const hydrate = useCallback((value: ModerationStateDto) => {
    setXp(value.progression.totalXp);
    setPity5(String(value.gachaState.pity5));
    setPity4(String(value.gachaState.pity4));
    setCapture(String(value.gachaState.captureProgress));
    setGuarantee(value.gachaState.guaranteedFeatured5);
    setStella(value.stella.quantity);
  }, []);

  const accept = useCallback(
    (value: ModerationStateDto) => {
      setState(value);
      setSelectedTargetId(value.player.id);
      hydrate(value);
      onAppliedRef.current(value);
      setMessage(null);
    },
    [hydrate],
  );

  useEffect(() => {
    if (!systemAvailable) return;
    const revision = ++requestRevision.current;
    void onLoadRef
      .current()
      .then((value) => {
        if (requestRevision.current === revision) accept(value);
      })
      .catch((error) => {
        if (requestRevision.current === revision)
          setMessage(apiErrorMessage(error));
      })
      .finally(() => {
        if (requestRevision.current === revision) setPending(false);
      });
    return () => {
      requestRevision.current += 1;
    };
  }, [accept, actorPlayerId, systemAvailable]);

  useEffect(() => {
    if (!isSuper || !query.trim()) return;
    let active = true;
    const timer = window.setTimeout(
      () =>
        void onListPlayers({ query, page: 1, sort: "name", direction: "asc" })
          .then((value) => {
            if (active) setPlayers(value.players);
          })
          .catch((error) => {
            if (active) setMessage(apiErrorMessage(error));
          }),
      120,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isSuper, onListPlayers, query]);

  const execute = async (
    action: () => Promise<ModerationStateDto>,
    afterSuccess?: () => void,
  ) => {
    if (pending) return;
    const revision = ++requestRevision.current;
    setPending(true);
    setMessage(null);
    try {
      const value = await action();
      if (requestRevision.current !== revision) return;
      accept(value);
      afterSuccess?.();
    } catch (error) {
      if (requestRevision.current === revision)
        setMessage(apiErrorMessage(error));
    } finally {
      if (requestRevision.current === revision) setPending(false);
    }
  };
  const submit = (
    event: FormEvent,
    action: () => Promise<ModerationStateDto>,
  ) => {
    event.preventDefault();
    void execute(action);
  };
  const selectTarget = (id: string) => {
    if (id === selectedTargetId) {
      setQuery("");
      setPlayers([]);
      return;
    }
    void execute(
      () => onLoadRef.current(id),
      () => {
        setQuery("");
        setPlayers([]);
      },
    );
  };

  return (
    <div className="screen-content moderation-screen long-screen-layout">
      <ScrollableScreenPanel
        className="moderation-screen-panel"
        bodyClassName="moderation-tools-body"
        fixed={<>
            <nav
              className="moderation-tabs"
              role="tablist"
              aria-label="Outils de modération"
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                  return;
                event.preventDefault();
                const tabs = availableTabs;
                const offset = event.key === "ArrowRight" ? 1 : tabs.length - 1;
                const next = tabs[(tabs.indexOf(activeTab) + offset) % tabs.length]!;
                setActiveTab(next);
                ({ system: systemTabRef, characters: charactersTabRef, codes: codesTabRef, banners: bannersTabRef,
                  events: eventsTabRef, community: communityTabRef, giveaway: giveawayTabRef, audit: auditTabRef }[next]).current?.focus();
              }}
            >
              {systemAvailable && <AppButton
                ref={systemTabRef}
                role="tab"
                aria-selected={activeTab === "system"}
                tabIndex={activeTab === "system" ? 0 : -1}
                className={activeTab === "system" ? "active" : ""}
                onClick={() => setActiveTab("system")}
              >
                Système
              </AppButton>}
              {isSuper && <AppButton ref={charactersTabRef} role="tab" aria-selected={activeTab === "characters"}
                tabIndex={activeTab === "characters" ? 0 : -1} className={activeTab === "characters" ? "active" : ""}
                onClick={() => setActiveTab("characters")}>Personnages</AppButton>}
              {codesAvailable && <AppButton
                ref={codesTabRef}
                role="tab"
                aria-selected={activeTab === "codes"}
                tabIndex={activeTab === "codes" ? 0 : -1}
                className={activeTab === "codes" ? "active" : ""}
                onClick={() => setActiveTab("codes")}
              >
                Codes
              </AppButton>}
              {isSuper && <AppButton ref={bannersTabRef} role="tab" aria-selected={activeTab === "banners"}
                tabIndex={activeTab === "banners" ? 0 : -1} className={activeTab === "banners" ? "active" : ""}
                onClick={() => setActiveTab("banners")}>Bannières</AppButton>}
              {isSuper && <AppButton ref={eventsTabRef} role="tab" aria-selected={activeTab === "events"}
                tabIndex={activeTab === "events" ? 0 : -1} className={activeTab === "events" ? "active" : ""}
                onClick={() => setActiveTab("events")}>Événements</AppButton>}
              {capabilities.communityModeration && <AppButton
                ref={communityTabRef}
                role="tab"
                aria-selected={activeTab === "community"}
                tabIndex={activeTab === "community" ? 0 : -1}
                className={activeTab === "community" ? "active" : ""}
                onClick={() => setActiveTab("community")}
              >
                Communauté
              </AppButton>}
              {capabilities.communityModeration && <AppButton
                ref={giveawayTabRef}
                role="tab"
                aria-selected={activeTab === "giveaway"}
                tabIndex={activeTab === "giveaway" ? 0 : -1}
                className={activeTab === "giveaway" ? "active" : ""}
                onClick={() => setActiveTab("giveaway")}
              >
                Giveaway
              </AppButton>}
              {isSuper && <AppButton ref={auditTabRef} role="tab" aria-selected={activeTab === "audit"}
                tabIndex={activeTab === "audit" ? 0 : -1} className={activeTab === "audit" ? "active" : ""}
                onClick={() => setActiveTab("audit")}>Journal</AppButton>}
            </nav>
            {(activeTab === "system" || activeTab === "characters") && (
              <section className="panel moderation-target" aria-busy={pending}>
                <div className="moderation-target-heading">
                  <div>
                    <span className="eyebrow">Joueur ciblé</span>
                    <strong title={state?.player.displayName}>
                      {state?.player.displayName ?? "Chargement…"}
                    </strong>
                    <small>
                      Rang :{" "}
                      {state
                        ? moderationRankLabels[state.player.rank]
                        : "Chargement…"}
                    </small>
                  </div>
                  {isSuper && (
                    <div className="moderation-target-actions">
                      <button
                        type="button"
                        className="moderation-self-button"
                        disabled={pending || isSelf}
                        onClick={() => selectTarget(actorPlayerId)}
                      >
                        Moi
                      </button>
                      <button
                        type="button"
                        className="moderation-self-button primary"
                        disabled={pending}
                        onClick={() => setBrowserOpen(true)}
                      >
                        Choisir
                      </button>
                    </div>
                  )}
                </div>
                {isSuper && (
                  <label className="moderation-target-search">
                    <span>Recherche rapide d’un joueur actif</span>
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPlayers([]);
                      }}
                      placeholder="Saisir un pseudo…"
                      autoComplete="off"
                    />
                  </label>
                )}
                {isSuper && query.trim() && (
                  <div
                    className="moderation-target-results"
                    role="listbox"
                    aria-label="Résultats de recherche"
                  >
                    {players.length > 0 ? (
                      players.map((candidate) => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={candidate.id === selectedTargetId}
                          className={
                            candidate.id === selectedTargetId ? "active" : ""
                          }
                          disabled={pending}
                          onClick={() => selectTarget(candidate.id)}
                          key={candidate.id}
                        >
                          <PlayerIdentityInline {...candidate} detail={`Niveau ${candidate.level}`} />
                          {candidate.tester && (
                            <span className="moderation-tester-badge">
                              Testeur
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="moderation-target-empty">
                        Aucun joueur trouvé.
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}
            {activeTab === "system" && (
              <p
                className={`moderation-feedback${message ? " error" : " empty"}`}
                role={message ? "alert" : undefined}
              >
                {message ?? "\u00a0"}
              </p>
            )}
          </>}
      >
        {activeTab === "system" && (
          <div className="moderation-grid">
            {isSuper && state && <RoleAdminPanel state={state} onChanged={async () => {
              try { accept(await onLoadRef.current(selectedTargetId)); }
              catch { window.location.reload(); }
            }} />}
            <form
              className="panel moderation-tool"
              onSubmit={(event) =>
                submit(event, () =>
                  onResource(selectedTargetId, {
                    resourceKey,
                    amount,
                    direction: "add",
                  }),
                )
              }
            >
              <ModerationToolHeading
                title="Ressources"
                current={currentResource}
              />
              <label>
                Ressource
                <select
                  value={resourceKey}
                  onChange={(event) => setResourceKey(event.target.value)}
                >
                  {resources.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Montant
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={amount}
                  onChange={(event) =>
                    setAmount(integerText(event.target.value))
                  }
                />
              </label>
              <div className="moderation-actions">
                <button disabled={pending}>Ajouter</button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    void execute(() =>
                      onResource(selectedTargetId, {
                        resourceKey,
                        amount,
                        direction: "remove",
                      }),
                    )
                  }
                >
                  Retirer
                </button>
              </div>
            </form>
            {canUseGameplayTools && (
              <>
                <form
                  className="panel moderation-tool moderation-tool-footer-layout"
                  onSubmit={(event) =>
                    submit(event, () => onXp(selectedTargetId, { totalXp: xp }))
                  }
                >
                  <ModerationToolHeading
                    title="Progression"
                    current={
                      state
                        ? `Actuel : ${formatResourceAmount(state.progression.totalXp)} XP · Niveau ${state.progression.level}`
                        : "Actuel : chargement…"
                    }
                  />
                  <label>
                    XP totale
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={xp}
                      onChange={(event) =>
                        setXp(integerText(event.target.value))
                      }
                    />
                  </label>
                  <div className="moderation-actions">
                    <button disabled={pending}>Définir l’XP</button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void execute(() =>
                          onXp(selectedTargetId, { prepareNextLevel: true }),
                        )
                      }
                    >
                      Préparer prochain niveau
                    </button>
                  </div>
                </form>
                <form
                  className="panel moderation-tool"
                  onSubmit={(event) =>
                    submit(event, () =>
                      onGacha(selectedTargetId, {
                        pity5: Number(pity5),
                        pity4: Number(pity4),
                        captureProgress: Number(capture),
                        guaranteedFeatured5: guarantee,
                      }),
                    )
                  }
                >
                  <ModerationToolHeading
                    title="Gacha"
                    current={
                      state
                        ? `Actuel : Pity 5★ ${state.gachaState.pity5} · Pity 4★ ${state.gachaState.pity4} · Capture ${state.gachaState.captureProgress}/3 · Garantie ${state.gachaState.guaranteedFeatured5 ? "Oui" : "Non"}`
                        : "Actuel : chargement…"
                    }
                  />
                  <div className="moderation-inline">
                    <label>
                      Pity 5★
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        value={pity5}
                        onChange={(event) =>
                          setPity5(integerText(event.target.value))
                        }
                      />
                    </label>
                    <button type="button" onClick={() => setPity5("89")}>
                      89
                    </button>
                    <label>
                      Pity 4★
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        value={pity4}
                        onChange={(event) =>
                          setPity4(integerText(event.target.value))
                        }
                      />
                    </label>
                    <button type="button" onClick={() => setPity4("9")}>
                      9
                    </button>
                  </div>
                  <label>
                    Capture (0–3)
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={capture}
                      onChange={(event) =>
                        setCapture(integerText(event.target.value))
                      }
                    />
                  </label>
                  <label className="moderation-check">
                    <input
                      type="checkbox"
                      checked={guarantee}
                      onChange={(event) => setGuarantee(event.target.checked)}
                    />
                    Garantie 5★
                  </label>
                  <button disabled={pending}>Appliquer</button>
                </form>
                <form
                  className="panel moderation-tool moderation-tool-footer-layout"
                  onSubmit={(event) =>
                    submit(event, () => onStella(selectedTargetId, stella))
                  }
                >
                  <ModerationToolHeading
                    title="Objets"
                    current={
                      state
                        ? `Actuel : ${formatResourceAmount(state.stella.quantity)} Stella`
                        : "Actuel : chargement…"
                    }
                  />
                  <label>
                    Masterless Stella Fortuna
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={stella}
                      onChange={(event) =>
                        setStella(integerText(event.target.value))
                      }
                    />
                  </label>
                  <button disabled={pending}>Définir la quantité</button>
                </form>
              </>
            )}
          </div>
        )}
        {activeTab === "codes" && codesAvailable && (
          <GiftCodeAdminPanel
            onLoad={onLoadGiftCodes!}
            onCreate={onCreateGiftCode!}
            onPublish={onPublishGiftCode!}
            onUpdate={onUpdateGiftCode!}
            onClaimants={onGiftCodeClaimants!}
          />
        )}
        {activeTab === "characters" && isSuper && state && <CharacterAdminPanel playerId={selectedTargetId} playerName={state.player.displayName} />}
        {activeTab === "banners" && isSuper && <BannerAdminPanel />}
        {activeTab === "events" && isSuper && <EventAdminPanel />}
        {activeTab === "community" && capabilities.communityModeration && (
          <div className="admin-domain"><div className="admin-subtabs">
            <button type="button" aria-pressed={communityType === 'chat'} onClick={() => setCommunityType('chat')}>Chat global</button>
            <button type="button" aria-pressed={communityType === 'dm'} onClick={() => setCommunityType('dm')}>Messages privés</button>
          </div>{communityType === 'chat' ? <GlobalChatReportsPanel /> : <DirectMessageReportsPanel />}</div>
        )}
        {activeTab === "giveaway" && capabilities.communityModeration && (
          <GiveawayAdminPanel admin={capabilities.superTools} />
        )}
        {activeTab === "audit" && isSuper && <AdminAuditPanel />}
      </ScrollableScreenPanel>
      {browserOpen && (
        <ModerationPlayerBrowser
          selectedPlayerId={selectedTargetId}
          onListPlayers={onListPlayers}
          onConfirm={(playerId) => {
            setBrowserOpen(false);
            selectTarget(playerId);
          }}
          onClose={() => setBrowserOpen(false)}
        />
      )}
    </div>
  );
}

function ModerationToolHeading({
  title,
  current,
}: {
  title: string;
  current: string;
}) {
  return (
    <header className="moderation-tool-heading">
      <h2>{title}</h2>
      <small className="moderation-current">
        {current.replace(/^Actuel :\s*/, "")}
      </small>
    </header>
  );
}

function moderationResourceCurrent(
  state: ModerationStateDto | null,
  resourceKey: string,
) {
  if (!state) return "Actuel : chargement…";
  if (resourceKey === "primogems")
    return `Actuel : ${formatResourceAmount(state.resources.primogems)} Primos`;
  if (resourceKey === "moras")
    return `Actuel : ${formatResourceAmount(state.resources.moras)} Moras`;
  const element = resourceKey.replace(
    "particles_",
    "",
  ) as keyof ModerationStateDto["resources"]["particles"];
  const label = resources.find(([key]) => key === resourceKey)?.[1] ?? "";
  return `Actuel : ${formatResourceAmount(state.resources.particles[element])} particules ${label}`;
}

export default ModerationScreen;
