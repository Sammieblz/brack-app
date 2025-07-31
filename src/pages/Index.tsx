import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Target, Timer, TrendingUp } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  const handleGetStarted = () => {
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-4xl mx-auto space-y-8">
          {/* Logo */}
          <div className="flex justify-center items-center space-x-3 mb-8">
            <BookOpen className="h-12 w-12 text-primary" />
            <span className="text-4xl font-bold text-primary">BRACK</span>
          </div>
          
          {/* Main Heading */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Track Your Reading
              <span className="text-primary"> Journey</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              The intuitive book tracking app that helps you stay motivated, 
              set goals, and discover your reading patterns.
            </p>
          </div>
          
          {/* CTA Button */}
          <div className="pt-8">
            <Button 
              onClick={handleGetStarted}
              size="lg"
              className="text-lg px-8 py-6 h-auto"
            >
              Start Your Reading Journey
            </Button>
          </div>
          
          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <Card className="text-center">
              <CardHeader>
                <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                <CardTitle>Set Goals</CardTitle>
                <CardDescription>
                  Set personalized reading goals and track your progress throughout the year
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="text-center">
              <CardHeader>
                <Timer className="h-8 w-8 text-primary mx-auto mb-2" />
                <CardTitle>Track Time</CardTitle>
                <CardDescription>
                  Monitor your reading sessions and discover your reading speed patterns
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="text-center">
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
                <CardTitle>Analyze Progress</CardTitle>
                <CardDescription>
                  Get insights into your reading habits and earn rewards for your achievements
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
