import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGoals } from "@/hooks/useGoals";
import { useToast } from "@/hooks/use-toast";
import { Plus, Target, Calendar as CalendarIcon, CheckCircle2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface GoalManagerProps {
  userId: string;
}

export const GoalManager = ({ userId }: GoalManagerProps) => {
  const { goals, activeGoals, createGoal, deleteGoal, completeGoal } = useGoals(userId);
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [goalType, setGoalType] = useState<'books_count' | 'pages_count' | 'reading_time'>('books_count');
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'yearly' | 'custom'>('yearly');
  const [targetValue, setTargetValue] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const handleCreate = async () => {
    if (!targetValue || !startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill in all required fields",
      });
      return;
    }

    const goalData: Record<string, unknown> = {
      goal_type: goalType,
      period_type: periodType,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      is_active: true,
    };

    if (goalType === 'books_count') {
      goalData.target_books = parseInt(targetValue);
    } else if (goalType === 'pages_count') {
      goalData.target_pages = parseInt(targetValue);
    } else {
      goalData.target_minutes = parseInt(targetValue);
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
    toast({
      title: "Goal completed! 🎉",
      description: "Congratulations on achieving your reading goal",
    });
  };

  const getGoalTypeLabel = (type: string) => {
    switch (type) {
      case 'books_count': return 'Books';
      case 'pages_count': return 'Pages';
      case 'reading_time': return 'Minutes';
      default: return type;
    }
  };

  const getPeriodTypeLabel = (type: string) => {
    switch (type) {
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'yearly': return 'Yearly';
      case 'custom': return 'Custom';
      default: return type;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Goals</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Goal Type</Label>
                <Select value={goalType} onValueChange={(v: string) => setGoalType(v)}>
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
                <Select value={periodType} onValueChange={(v: string) => setPeriodType(v)}>
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
                  placeholder={goalType === 'books_count' ? 'e.g., 12' : goalType === 'pages_count' ? 'e.g., 5000' : 'e.g., 3600'}
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "MMM dd, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "MMM dd, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Button onClick={handleCreate} className="w-full">Create Goal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-3">Active Goals</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {activeGoals.map((goal) => {
              const target = goal.target_books || goal.target_pages || goal.target_minutes || 0;
              const current = 0; // TODO: Calculate actual progress
              const progress = target > 0 ? (current / target) * 100 : 0;

              return (
                <Card key={goal.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg">
                            {target} {getGoalTypeLabel(goal.goal_type)}
                          </CardTitle>
                          <CardDescription>{getPeriodTypeLabel(goal.period_type)}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">{Math.round(progress)}%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Progress value={progress} />
                    <div className="text-sm text-muted-foreground">
                      {goal.start_date && goal.end_date && (
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(goal.start_date), "MMM dd")} - {format(new Date(goal.end_date), "MMM dd, yyyy")}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleComplete(goal.id)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Complete
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this goal? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(goal.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {activeGoals.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">No active goals</p>
              </CardContent>
            </Card>
          )}
        </div>

        {goals.filter(g => g.is_completed).length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Completed Goals</h3>
            <div className="space-y-2">
              {goals.filter(g => g.is_completed).map((goal) => (
                <Card key={goal.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">
                          {goal.target_books || goal.target_pages || goal.target_minutes} {getGoalTypeLabel(goal.goal_type)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Completed {goal.completed_at && format(new Date(goal.completed_at), "MMM dd, yyyy")}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Achieved
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
