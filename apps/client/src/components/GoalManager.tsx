import { type MutableRefObject, useRef, useState } from "react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Confetti } from "@/components/animations/Confetti";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { ProgressBarFill } from "@/components/animations/ProgressBarFill";
import { TrophyReveal } from "@/components/animations/TrophyReveal";
import LoadingSpinner from "@/components/LoadingSpinner";
import { APP_ICONS } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
import { BRACK_GOALS_IMAGE, BRACK_TROPHY_IMAGE } from "@/config/brackAssets";
import { useGoals, type Goal } from "@/hooks/useGoals";
import { useToast } from "@/hooks/use-toast";
import { countUp } from "@/lib/animations/gsap-presets";

interface GoalManagerProps {
  userId: string;
}

type GoalType = "books_count" | "pages_count" | "reading_time";
type PeriodType = "monthly" | "quarterly" | "yearly" | "custom";

export const GoalManager = ({ userId }: GoalManagerProps) => {
  const { goals, activeGoals, loading, error, createGoal, deleteGoal, completeGoal } = useGoals(userId);
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>("books_count");
  const [periodType, setPeriodType] = useState<PeriodType>("yearly");
  const [targetValue, setTargetValue] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [showConfetti, setShowConfetti] = useState(false);
  const [completedGoalId, setCompletedGoalId] = useState<string | null>(null);
  const progressRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const completedGoals = goals.filter((goal) => goal.is_completed);

  const handleCreate = async () => {
    if (!targetValue || !startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill in all required fields",
      });
      return;
    }

    const numericTarget = Math.max(1, Number.parseInt(targetValue, 10) || 0);
    const goalData: Record<string, unknown> = {
      goal_type: goalType,
      period_type: periodType,
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
      is_active: true,
    };

    if (goalType === "books_count") {
      goalData.target_books = numericTarget;
    } else if (goalType === "pages_count") {
      goalData.target_pages = numericTarget;
    } else {
      goalData.target_minutes = numericTarget;
    }

    const result = await createGoal(goalData);
    if (result) {
      toast({
        title: "Goal created",
        description: "Your reading goal has been created successfully",
      });
      setIsCreateOpen(false);
      setTargetValue("");
      setStartDate(undefined);
      setEndDate(undefined);
    }
  };

  const handleDelete = async (goalId: string) => {
    await deleteGoal(goalId);
    toast({
      title: "Goal deleted",
      description: "Your goal has been removed",
    });
  };

  const handleComplete = async (goalId: string) => {
    await completeGoal(goalId);
    setCompletedGoalId(goalId);
    setShowConfetti(true);
    window.setTimeout(() => setShowConfetti(false), 3000);
    toast({
      title: "Goal completed!",
      description: "Congratulations on achieving your reading goal",
    });
  };

  const totalActiveTarget = activeGoals.reduce((sum, goal) => sum + getGoalTarget(goal), 0);

  return (
    <>
      {showConfetti && <Confetti trigger={showConfetti} />}

      <div className="mx-auto w-full max-w-6xl space-y-5 lg:space-y-6">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <img
                src={BRACK_GOALS_IMAGE}
                alt=""
                aria-hidden="true"
                className="h-16 w-16 shrink-0 rounded-md border border-border/70 object-cover sm:h-20 sm:w-20"
                draggable={false}
              />
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
                  Reading Goals
                </h1>
                <p className="mt-1 max-w-2xl font-sans text-sm text-muted-foreground">
                  Set targets that keep your reading plan visible, measurable, and easy to act on.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:w-[29rem] lg:grid-cols-1">
              <section className="grid grid-cols-3 gap-2">
                <GoalMetric label="Active" value={activeGoals.length.toString()} />
                <GoalMetric label="Done" value={completedGoals.length.toString()} />
                <GoalMetric label="Target" value={totalActiveTarget.toString()} />
              </section>

              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="h-11 w-full sm:w-auto lg:w-full">
                    <AppIcon icon={APP_ICONS.common.add} variant="action" />
                    Create Goal
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[min(42rem,calc(var(--app-viewport-height,100dvh)-2rem))] max-w-md overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-display">Create New Goal</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Goal Type</Label>
                      <Select value={goalType} onValueChange={(value) => setGoalType(value as GoalType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="books_count">Books Count</SelectItem>
                          <SelectItem value="pages_count">Pages Count</SelectItem>
                          <SelectItem value="reading_time">Reading Time (minutes)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Period</Label>
                      <Select value={periodType} onValueChange={(value) => setPeriodType(value as PeriodType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Target</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder={
                          goalType === "books_count"
                            ? "e.g., 12"
                            : goalType === "pages_count"
                              ? "e.g., 5000"
                              : "e.g., 3600"
                        }
                        value={targetValue}
                        onChange={(event) => setTargetValue(event.target.value)}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <DatePicker
                        label="Start Date"
                        value={startDate}
                        onChange={(_value, date) => setStartDate(date)}
                      />
                      <DatePicker
                        label="End Date"
                        value={endDate}
                        onChange={(_value, date) => setEndDate(date)}
                      />
                    </div>

                    <Button onClick={handleCreate} className="w-full">
                      Create Goal
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {error && (
          <Card>
            <CardContent className="p-4 font-sans text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardContent className="flex min-h-[16rem] items-center justify-center">
              <LoadingSpinner />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="space-y-3">
              <SectionHeader
                title="Active Goals"
                subtitle="The targets currently shaping your reading plan."
                count={activeGoals.length}
              />

              {activeGoals.length === 0 ? (
                <EmptyGoalState />
              ) : (
                <div className="grid gap-4">
                  {activeGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      completedGoalId={completedGoalId}
                      onComplete={handleComplete}
                      onDelete={handleDelete}
                      progressRefs={progressRefs}
                    />
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
              <GoalSnapshot
                activeGoals={activeGoals}
                completedGoals={completedGoals}
                totalActiveTarget={totalActiveTarget}
              />
              <CompletedGoalsPanel goals={completedGoals} />
            </aside>
          </div>
        )}
      </div>
    </>
  );
};

const GoalCard = ({
  goal,
  completedGoalId,
  onComplete,
  onDelete,
  progressRefs,
}: {
  goal: Goal;
  completedGoalId: string | null;
  onComplete: (goalId: string) => Promise<void>;
  onDelete: (goalId: string) => Promise<void>;
  progressRefs: MutableRefObject<Record<string, HTMLSpanElement | null>>;
}) => {
  const target = getGoalTarget(goal);
  const current = 0;
  const progress = target > 0 ? (current / target) * 100 : 0;
  const progressPercentage = Math.round(progress);
  const unit = getGoalTypeLabel(goal.goal_type).toLowerCase();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={BRACK_GOALS_IMAGE}
                  alt=""
                  aria-hidden="true"
                  className="h-12 w-12 shrink-0 rounded-md border border-border/70 object-cover"
                  draggable={false}
                />
                <div className="min-w-0">
                  <h3 className="truncate font-display text-xl font-semibold">
                    {target} {getGoalTypeLabel(goal.goal_type)}
                  </h3>
                  <p className="font-sans text-sm text-muted-foreground">
                    {getPeriodTypeLabel(goal.period_type)} goal
                  </p>
                </div>
              </div>
              <Badge variant="secondary">
                <span
                  ref={(element) => {
                    progressRefs.current[goal.id] = element;
                    if (element) {
                      countUp(element, 0, progressPercentage, { duration: 1 });
                    }
                  }}
                >
                  {progressPercentage}
                </span>
                %
              </Badge>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-sans text-sm text-muted-foreground">Progress</p>
                  <p className="font-sans text-2xl font-semibold">
                    {current}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      of {target} {unit}
                    </span>
                  </p>
                </div>
                <p className="font-sans text-sm text-muted-foreground">{target - current} remaining</p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-background/80">
                <ProgressBarFill progress={Math.min(progress, 100)} duration={1} />
              </div>
            </div>

            {completedGoalId === goal.id && (
              <div className="flex items-center justify-center py-2">
                <TrophyReveal show size={48} />
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-lg border border-border/70 bg-background/45 p-4">
            <div className="space-y-3">
              {goal.start_date && goal.end_date && (
                <div className="space-y-1">
                  <p className="font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Goal window
                  </p>
                  <div className="flex items-start gap-2 font-sans text-sm">
                    <AppIcon icon={APP_ICONS.bookDetail.progressDate} variant="inline" className="mt-0.5 text-primary" />
                    <span>
                      {format(new Date(goal.start_date), "MMM dd")} -{" "}
                      {format(new Date(goal.end_date), "MMM dd, yyyy")}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <p className="font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Target type
                </p>
                <p className="font-sans text-sm">{getGoalTypeLabel(goal.goal_type)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => onComplete(goal.id)}>
                <AppIcon icon={APP_ICONS.common.checkCircle} variant="action" />
                Complete
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Delete goal">
                    <AppIcon icon={APP_ICONS.common.delete} variant="action" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display">Delete Goal</AlertDialogTitle>
                    <AlertDialogDescription className="font-sans">
                      Are you sure you want to delete this goal? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(goal.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SectionHeader = ({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count: number;
}) => (
  <div className="flex items-start justify-between gap-3">
    <div>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="font-sans text-sm text-muted-foreground">{subtitle}</p>
    </div>
    <Badge variant="outline">{count}</Badge>
  </div>
);

const GoalSnapshot = ({
  activeGoals,
  completedGoals,
  totalActiveTarget,
}: {
  activeGoals: Goal[];
  completedGoals: Goal[];
  totalActiveTarget: number;
}) => {
  const totalGoals = activeGoals.length + completedGoals.length;
  const completedRate = totalGoals > 0 ? Math.round((completedGoals.length / totalGoals) * 100) : 0;
  const nextDeadline = activeGoals
    .filter((goal) => goal.end_date)
    .sort((a, b) => new Date(a.end_date as string).getTime() - new Date(b.end_date as string).getTime())[0];

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h3 className="font-display text-lg font-semibold">Goal Snapshot</h3>
          <p className="font-sans text-sm text-muted-foreground">A quick read on your current targets.</p>
        </div>

        <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
          <SnapshotRow label="Active target" value={totalActiveTarget.toString()} />
          <SnapshotRow label="Completion rate" value={`${completedRate}%`} />
          <SnapshotRow
            label="Next deadline"
            value={nextDeadline?.end_date ? format(new Date(nextDeadline.end_date), "MMM dd") : "None"}
          />
        </div>

        <div>
          <div className="mb-2 flex justify-between font-sans text-xs text-muted-foreground">
            <span>Completed goals</span>
            <span>
              {completedGoals.length}/{totalGoals || 0}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${completedRate}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SnapshotRow = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border/70 bg-background/45 p-3">
    <p className="font-sans text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 truncate font-sans text-lg font-semibold">{value}</p>
  </div>
);

const CompletedGoalsPanel = ({ goals }: { goals: Goal[] }) => (
  <Card>
    <CardContent className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Completed</h3>
          <p className="font-sans text-sm text-muted-foreground">Goals you have already closed.</p>
        </div>
        <Badge variant="outline">{goals.length}</Badge>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center font-sans text-sm text-muted-foreground">
          Completed goals will appear here.
        </div>
      ) : (
        <div className="native-scroll max-h-[26rem] space-y-3 overflow-y-auto pr-1">
          {goals.map((goal) => (
            <CompletedGoalRow key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const CompletedGoalRow = ({ goal }: { goal: Goal }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/45 p-3">
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={BRACK_TROPHY_IMAGE}
        alt=""
        aria-hidden="true"
        className="h-10 w-10 shrink-0 rounded-md border border-border/70 object-cover"
        draggable={false}
      />
      <div className="min-w-0">
        <p className="truncate font-sans font-medium">
          {getGoalTarget(goal)} {getGoalTypeLabel(goal.goal_type)}
        </p>
        <p className="font-sans text-xs text-muted-foreground">
          {goal.completed_at ? format(new Date(goal.completed_at), "MMM dd, yyyy") : "Completed"}
        </p>
      </div>
    </div>
    <Badge variant="outline" className="shrink-0 border-primary/30 bg-primary/10 text-primary">
      Achieved
    </Badge>
  </div>
);

const GoalMetric = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-md border border-border/70 bg-background/45 p-3">
    <div className="min-w-0">
      <p className="font-sans text-lg font-semibold leading-none">{value}</p>
      <p className="mt-1 truncate font-sans text-[11px] text-muted-foreground">{label}</p>
    </div>
  </div>
);

const EmptyGoalState = () => (
  <PremiumEmptyState
    asset="emptyGoals"
    title="No active goals"
    description="Create one clear target to keep your dashboard and reading plan focused."
  />
);

const getGoalTarget = (goal: Goal) =>
  goal.target_books || goal.target_pages || goal.target_minutes || 0;

const getGoalTypeLabel = (type: string) => {
  switch (type) {
    case "books_count":
      return "Books";
    case "pages_count":
      return "Pages";
    case "reading_time":
      return "Minutes";
    default:
      return type;
  }
};

const getPeriodTypeLabel = (type: string) => {
  switch (type) {
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "yearly":
      return "Yearly";
    case "custom":
      return "Custom";
    default:
      return type;
  }
};
