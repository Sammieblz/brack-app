import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppIcon } from "@/components/ui/app-icon";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import {
  JourneyInlineEmpty,
  JourneySectionEyebrow,
  JourneySurface,
} from "@/components/journey/JourneySurface";
import { useJourneyCountdown } from "@/components/journey/useJourneyCountdown";
import { APP_ICONS } from "@/config/iconography";
import {
  formatQuestValue,
  getQuestActionLabel,
  getQuestProgressLabel,
} from "@/lib/journey";
import { questProgressPercent } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import type { QuestAssignment } from "@/services/api/gamification";
import type { Book } from "@/types";

export interface JourneyQuestActionProps {
  onAction: (quest: QuestAssignment) => void;
  actionLoading: boolean;
}

interface JourneyQuestsProps extends JourneyQuestActionProps {
  dailyQuests: QuestAssignment[];
  weeklyQuests: QuestAssignment[];
  tomorrowQuests: Array<Pick<
    QuestAssignment,
    "id" | "title" | "description" | "metric" | "target_value" | "reward_ink"
  >>;
  serverTime: string;
  timezone: string;
  receivedAt?: string | null;
  collapseWeekly: boolean;
}

export const JourneyQuests = ({
  dailyQuests,
  weeklyQuests,
  tomorrowQuests,
  serverTime,
  timezone,
  receivedAt,
  collapseWeekly,
  onAction,
  actionLoading,
}: JourneyQuestsProps) => (
  <div className="space-y-5">
    <div>
      <JourneySectionEyebrow>Make today count</JourneySectionEyebrow>
      <h2 className="font-display text-2xl font-bold">Your quests</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Rewards arrive automatically when synced progress reaches the target.
      </p>
    </div>
    <QuestGroup
      title="Daily quests"
      description="Small wins that refresh each day"
      quests={dailyQuests}
      serverTime={serverTime}
      timezone={timezone}
      receivedAt={receivedAt}
      onAction={onAction}
      actionLoading={actionLoading}
    />
    <QuestGroup
      title="Weekly quests"
      description="Longer challenges that build your reading rhythm"
      quests={weeklyQuests}
      serverTime={serverTime}
      timezone={timezone}
      receivedAt={receivedAt}
      onAction={onAction}
      actionLoading={actionLoading}
      collapsible
      defaultOpen={!collapseWeekly}
    />
    {tomorrowQuests.length > 0 && <TomorrowPreview quests={tomorrowQuests} />}
  </div>
);

const QuestGroup = ({
  title,
  description,
  quests,
  serverTime,
  timezone,
  receivedAt,
  onAction,
  actionLoading,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  description: string;
  quests: QuestAssignment[];
  serverTime: string;
  timezone: string;
  receivedAt?: string | null;
  onAction: (quest: QuestAssignment) => void;
  actionLoading: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) => {
  const active = quests.filter((quest) => quest.status === "active");
  const ended = quests.filter((quest) => quest.status !== "active");
  const [open, setOpen] = useState(defaultOpen);

  const content = (
    <div className="space-y-4 pt-4">
      {active.length === 0 && ended.length === 0 ? (
        <JourneyInlineEmpty
          title="No quests this period"
          description="The next set will appear automatically."
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
              {active.map((quest) => (
                <JourneyQuestCard
                  key={quest.id}
                  quest={quest}
                  serverTime={serverTime}
                  timezone={timezone}
                  receivedAt={receivedAt}
                  onAction={onAction}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}
          {ended.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Finished this period
              </p>
              {ended.map((quest) => (
                <CompletedQuestRow key={quest.id} quest={quest} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <JourneySurface variant="flat" className="p-4 sm:p-5">
        <div>
          <h3 className="font-display text-xl font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {content}
      </JourneySurface>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <JourneySurface variant="flat" className="p-4 sm:p-5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>
              <span className="block font-display text-xl font-bold">{title}</span>
              <span className="block text-sm text-muted-foreground">{description}</span>
            </span>
            <AppIcon
              icon={APP_ICONS.common.collapse}
              variant="action"
              className={cn(
                "shrink-0 transition-transform motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>{content}</CollapsibleContent>
      </JourneySurface>
    </Collapsible>
  );
};

export const JourneyQuestCard = ({
  quest,
  serverTime,
  timezone,
  receivedAt,
  onAction,
  actionLoading,
  featured = false,
}: {
  quest: QuestAssignment;
  serverTime: string;
  timezone: string;
  receivedAt?: string | null;
  onAction: (quest: QuestAssignment) => void;
  actionLoading: boolean;
  featured?: boolean;
}) => {
  const percentage = questProgressPercent(quest.progress_value, quest.target_value);
  const countdown = useJourneyCountdown(
    quest.period_end,
    serverTime,
    timezone,
    receivedAt,
  );
  const complete = quest.status === "completed";

  return (
    <div className={cn(
      "flex h-full flex-col",
      featured
        ? "mt-4"
        : "rounded-xl border border-border/70 bg-background/50 p-4",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={cn("font-semibold", featured && "font-display text-xl")}>{quest.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{quest.description}</p>
        </div>
        {complete && <Badge>Complete</Badge>}
      </div>
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium">{getQuestProgressLabel(quest)}</span>
          <span className="text-muted-foreground">{Math.round(percentage)}%</span>
        </div>
        <Progress
          value={percentage}
          className={cn("h-2", featured && "h-2.5")}
          aria-label={`${quest.title}: ${getQuestProgressLabel(quest)}`}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="gap-1 py-1">
            <CurrencyIcon currency="ink" size="md" />
            +{quest.reward_ink.toLocaleString()} Ink
          </Badge>
          {quest.reward_gold_leaves > 0 && (
            <Badge variant="outline" className="gap-1 py-1">
              <CurrencyIcon currency="goldLeaves" size="md" />
              +{quest.reward_gold_leaves.toLocaleString()} Gold {quest.reward_gold_leaves === 1 ? "Leaf" : "Leaves"}
            </Badge>
          )}
        </div>
        {!complete && (
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            onClick={() => onAction(quest)}
            disabled={actionLoading}
          >
            {getQuestActionLabel(quest.metric)}
          </Button>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{complete ? "Reward earned" : countdown}</p>
    </div>
  );
};

const CompletedQuestRow = ({ quest }: { quest: QuestAssignment }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{quest.title}</p>
      <p className="text-xs text-muted-foreground">
        {quest.status === "completed" ? "Complete" : "Ended"} · {getQuestProgressLabel(quest)}
      </p>
    </div>
    {quest.status === "completed" ? (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
        <CurrencyIcon currency="ink" size="md" />
        +{quest.reward_ink.toLocaleString()}
      </span>
    ) : (
      <span className="shrink-0 text-xs text-muted-foreground">No reward</span>
    )}
  </div>
);

const TomorrowPreview = ({
  quests,
}: {
  quests: Array<Pick<QuestAssignment, "id" | "title" | "description" | "metric" | "target_value" | "reward_ink">>;
}) => (
  <Collapsible asChild>
    <JourneySurface variant="flat" className="p-4 sm:p-5">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>
            <span className="block font-display text-lg font-bold">Tomorrow&apos;s preview</span>
            <span className="block text-sm text-muted-foreground">
              See {quests.length} upcoming {quests.length === 1 ? "quest" : "quests"}
            </span>
          </span>
          <AppIcon icon={APP_ICONS.common.collapse} variant="action" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
          {quests.map((quest) => (
            <div key={quest.id} className="rounded-xl border border-border/60 bg-background/40 p-4">
              <p className="font-medium">{quest.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{quest.description}</p>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                <span>{formatQuestValue(quest.target_value, quest.metric)}</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <CurrencyIcon currency="ink" size="md" />
                  +{quest.reward_ink.toLocaleString()} Ink
                </span>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </JourneySurface>
  </Collapsible>
);

export const JourneyQuestBookPicker = ({
  mode,
  books,
  onOpenChange,
  onSelect,
}: {
  mode: "timer" | "progress" | null;
  books: Book[];
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: "timer" | "progress", book: Book) => void;
}) => (
  <Dialog open={Boolean(mode)} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[min(36rem,calc(100dvh-2rem))] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{mode === "timer" ? "Start reading" : "Log progress"}</DialogTitle>
        <DialogDescription>Choose the book that should count toward this quest.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        {books.map((book) => (
          <button
            key={book.id}
            type="button"
            onClick={() => mode && onSelect(mode, book)}
            className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border/70 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt=""
                className="h-14 w-10 shrink-0 rounded object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="grid h-14 w-10 shrink-0 place-items-center rounded bg-muted">
                <AppIcon icon={APP_ICONS.dashboard.coverFallback} variant="empty" size="md" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <strong className="block truncate font-serif text-sm">{book.title}</strong>
              {book.author && <span className="block truncate text-xs text-muted-foreground">{book.author}</span>}
            </span>
          </button>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
