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
    <div className="min-h-screen bg-gradient-background flex items-center justify-center px-4 py-8 relative overflow-hidden safe-top safe-bottom">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-glow/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="p-3 bg-gradient-primary rounded-2xl shadow-glow animate-glow-pulse">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <span className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              BRACK
            </span>
          </div>
        </div>

        {/* Welcome Card */}
        <Card className="bg-gradient-card shadow-medium border-0 text-center animate-scale-in" style={{ animationDelay: '0.2s' }}>
          <CardContent className="p-8 space-y-8">
            {/* Welcome Message */}
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-foreground">
                Welcome, {userName}! 
                <span className="inline-block animate-[float_2s_ease-in-out_infinite] ml-2">👋</span>
              </h1>
              <p className="text-muted-foreground text-lg">
                Ready to start tracking your reading journey?
              </p>
            </div>
            
            {/* Goal Card */}
            <div className="p-6 bg-gradient-primary/10 rounded-2xl border border-primary/20 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-soft">
                <Target className="h-6 w-6 text-white" />
              </div>
              <p className="text-foreground font-medium">
                Do you have a reading goal in mind?
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                Setting goals helps you stay motivated and track progress
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <Button 
                onClick={handleSetGoal} 
                className="w-full h-14 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium text-lg"
              >
                <Target className="mr-3 h-5 w-5" />
                Set My Reading Goal
              </Button>
              
              <Button 
                onClick={handleSkip} 
                variant="outline" 
                className="w-full h-12 border-border/50 hover:shadow-soft transition-all duration-300 font-medium"
              >
                <SkipForward className="mr-2 h-4 w-4" />
                Skip for Now
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: '0.8s' }}>
              You can always set or change your goals later in settings
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Welcome;