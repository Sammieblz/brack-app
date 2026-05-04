import { type ComponentType, type MutableRefObject, useRef, useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, CheckCircle, Plus, Trash } from "iconoir-react";
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
import { ProgressBarFill } from "@/components/animations/ProgressBarFill";
import { TrophyReveal } from "@/components/animations/TrophyReveal";
import LoadingSpinner from "@/components/LoadingSpinner";
import { APP_ICONS } from "@/config/iconography";
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

      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src={BRACK_GOALS_IMAGE}
              alt=""
              aria-hidden="true"
              className="h-14 w-14 shrink-0 rounded-md border border-border/70 object-cover"
              draggable={false}
            />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Reading Goals</h1>
              <p className="font-sans text-sm text-muted-foreground">
                Set targets that keep your reading plan visible and measurable.
              </p>
            </div>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
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

        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          <GoalMetric icon={APP_ICONS.dashboard.goal} label="Active" value={activeGoals.length.toString()} />
          <GoalMetric icon={APP_ICONS.profile.badges} label="Completed" value={completedGoals.length.toString()} />
          <GoalMetric icon={APP_ICONS.stats.pagesRead} label="Active target" value={totalActiveTarget.toString()} />
        </section>

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
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold">Active Goals</h2>
                <Badge variant="outline">{activeGoals.length}</Badge>
              </div>

              {activeGoals.length === 0 ? (
                <EmptyGoalState />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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

            {completedGoals.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold">Completed Goals</h2>
                  <Badge variant="outline">{completedGoals.length}</Badge>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {completedGoals.map((goal) => (
                    <CompletedGoalCard key={goal.id} goal={goal} />
                  ))}
                </div>
              </section>
            )}
          </>
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

  return (
    <Card>
      <CardContent className="space-y-5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={BRACK_GOALS_IMAGE}
              alt=""
              aria-hidden="true"
              className="h-11 w-11 shrink-0 rounded-md border border-border/70 object-cover"
              draggable={false}
            />
            <div className="min-w-0">
              <h3 className="truncate font-sans text-lg font-semibold">
                {target} {getGoalTypeLabel(goal.goal_type)}
              </h3>
              <p className="font-sans text-sm text-muted-foreground">
                {getPeriodTypeLabel(goal.period_type)}
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

        <div className="space-y-2">
          <div className="flex justify-between font-sans text-xs text-muted-foreground">
            <span>{current} complete</span>
            <span>{target} target</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <ProgressBarFill progress={Math.min(progress, 100)} duration={1} />
          </div>
        </div>

        {completedGoalId === goal.id && (
          <div className="flex items-center justify-center py-2">
            <TrophyReveal show size={48} />
          </div>
        )}

        {goal.start_date && goal.end_date && (
          <div className="flex items-center gap-2 font-sans text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            {format(new Date(goal.start_date), "MMM dd")} -{" "}
            {format(new Date(goal.end_date), "MMM dd, yyyy")}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onComplete(goal.id)}>
            <CheckCircle className="h-4 w-4" />
            Complete
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Delete goal">
                <Trash className="h-4 w-4" />
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
      </CardContent>
    </Card>
  );
};

const CompletedGoalCard = ({ goal }: { goal: Goal }) => (
  <Card>
    <CardContent className="flex items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={BRACK_TROPHY_IMAGE}
          alt=""
          aria-hidden="true"
          className="h-11 w-11 shrink-0 rounded-md border border-border/70 object-cover"
          draggable={false}
        />
        <div className="min-w-0">
          <p className="truncate font-sans font-medium">
            {getGoalTarget(goal)} {getGoalTypeLabel(goal.goal_type)}
          </p>
          <p className="font-sans text-sm text-muted-foreground">
            Completed {goal.completed_at ? format(new Date(goal.completed_at), "MMM dd, yyyy") : ""}
          </p>
        </div>
      </div>
      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
        Achieved
      </Badge>
    </CardContent>
  </Card>
);

const GoalMetric = ({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) => (
  <Card>
    <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary sm:h-10 sm:w-10">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <p className="font-sans text-lg font-semibold leading-none sm:text-2xl">{value}</p>
        <p className="mt-1 truncate font-sans text-[11px] text-muted-foreground sm:text-sm">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const EmptyGoalState = () => (
  <Card>
    <CardContent className="flex min-h-[18rem] flex-col items-center justify-center p-8 text-center">
      <img
        src={BRACK_GOALS_IMAGE}
        alt=""
        aria-hidden="true"
        className="mb-4 h-20 w-20 rounded-md border border-border/70 object-cover"
        draggable={false}
      />
      <h2 className="font-display text-xl font-semibold">No active goals</h2>
      <p className="mt-2 max-w-sm font-sans text-sm text-muted-foreground">
        Create one clear target to keep your dashboard and reading plan focused.
      </p>
    </CardContent>
  </Card>
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
