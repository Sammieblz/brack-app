import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Target, SkipForward } from "lucide-react";

const Welcome = () => {
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      
      // Get display name from user metadata or email
      const displayName = user.user_metadata?.full_name || 
                          user.user_metadata?.name || 
                          user.email?.split('@')[0] || 
                          'there';
      setUserName(displayName);
    };
    
    getUser();
  }, [navigate]);

  const handleSetGoal = () => {
    navigate("/questionnaire");
  };

  const handleSkip = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-primary">BRACK</span>
            </div>
          </div>
          <CardTitle className="text-2xl">
            Welcome, {userName}! 👋
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-muted-foreground">
            Ready to start tracking your reading journey?
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-accent rounded-lg">
              <Target className="h-6 w-6 text-accent-foreground mx-auto mb-2" />
              <p className="text-sm text-accent-foreground">
                Do you have a reading goal in mind?
              </p>
            </div>
            
            <div className="flex flex-col space-y-3">
              <Button onClick={handleSetGoal} className="w-full">
                <Target className="mr-2 h-4 w-4" />
                Set My Reading Goal
              </Button>
              
              <Button onClick={handleSkip} variant="outline" className="w-full">
                <SkipForward className="mr-2 h-4 w-4" />
                Skip for Now
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            You can always set or change your goals later
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Welcome;