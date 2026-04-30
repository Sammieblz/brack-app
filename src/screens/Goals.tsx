import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarIcon, Clock } from "iconoir-react";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { BrandedRouteTransition } from "@/components/animations/BrandedRouteTransition";
import { BRACK_GOALS_IMAGE } from "@/config/brackAssets";
import { format } from "date-fns";

type GoalsTransition = {
  to: string;
  message: string;
};

const Goals = () => {
  const [targetBooks, setTargetBooks] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("19:00");
  const [loading, setLoading] = useState(false);
  const [transition, setTransition] = useState<GoalsTransition | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          target_books: parseInt(targetBooks) || null,
          start_date: startDate?.toISOString().split('T')[0] || null,
          end_date: endDate?.toISOString().split('T')[0] || null,
          reminder_time: reminderEnabled ? reminderTime : null,
        });

      if (error) throw error;

      toast({
        title: "Reading goal set!",
        description: "You're all set to start tracking your reading progress.",
      });

      setTransition({
        to: "/dashboard",
        message: "Finalizing your setup...",
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error saving goal",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (transition) {
    return <BrandedRouteTransition to={transition.to} message={transition.message} />;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-5xl items-center justify-center md:min-h-[calc(100vh-4rem)]">
        <Card className="w-full overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="border-b border-border/70 bg-muted/20 p-5 lg:border-b-0 lg:border-r lg:p-8">
              <div className="mb-6 flex items-center gap-2">
                <ThemeAwareLogo variant="icon" tone="theme" size="h-9 w-9" className="drop-shadow-sm" />
                <span className="font-display text-xl font-bold text-primary">BRACK</span>
              </div>

              <div className="space-y-5">
                <div className="overflow-hidden rounded-md border border-border/70 bg-background">
                  <img
                    src={BRACK_GOALS_IMAGE}
                    alt="Goal target illustration"
                    className="aspect-[4/3] w-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="space-y-2">
                  <h1 className="font-display text-2xl font-bold md:text-3xl">
                    Set a reading target
                  </h1>
                  <p className="font-sans text-sm text-muted-foreground md:text-base">
                    Choose a goal and cadence that gives your dashboard something useful to track.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <CardHeader>
                <CardTitle className="font-display">Set Your Reading Goal</CardTitle>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="targetBooks">How many books do you want to read?</Label>
                    <Input
                      id="targetBooks"
                      type="number"
                      placeholder="e.g., 12"
                      value={targetBooks}
                      onChange={(e) => setTargetBooks(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "MMM dd, yyyy") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "MMM dd, yyyy") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="text-base">Daily Reminders</Label>
                        <div className="font-sans text-sm text-muted-foreground">
                          Get reminded to read every day
                        </div>
                      </div>
                      <Switch
                        checked={reminderEnabled}
                        onCheckedChange={setReminderEnabled}
                      />
                    </div>
                    
                    {reminderEnabled && (
                      <div className="space-y-2">
                        <Label htmlFor="reminderTime">Reminder Time</Label>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reminderTime"
                            type="time"
                            value={reminderTime}
                            onChange={(e) => setReminderTime(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-4 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => navigate("/questionnaire")}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? "Setting Goal..." : "Complete Setup"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Goals;
