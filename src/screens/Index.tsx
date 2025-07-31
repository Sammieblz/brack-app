import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Target, Timer, TrendingUp } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 bg-gradient-primary rounded-3xl shadow-glow animate-pulse">
            <BookOpen className="h-12 w-12 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  const handleGetStarted = () => {
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary-glow/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      </div>
      
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center min-h-screen p-4 relative z-10">
        <div className="text-center max-w-5xl mx-auto space-y-12">
          {/* Logo */}
          <div className="flex justify-center items-center space-x-4 mb-12 animate-fade-in">
            <div className="p-4 bg-gradient-primary rounded-3xl shadow-glow animate-glow-pulse">
              <BookOpen className="h-12 w-12 text-white" />
            </div>
            <span className="text-5xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              BRACK
            </span>
          </div>
          
          {/* Main Heading */}
          <div className="space-y-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
              Track Your Reading
              <br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">Journey</span>
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              The intuitive book tracking app that helps you stay motivated, 
              set goals, and discover your reading patterns.
            </p>
          </div>
          
          {/* CTA Button */}
          <div className="pt-8 animate-scale-in" style={{ animationDelay: '0.4s' }}>
            <Button 
              onClick={handleGetStarted}
              className="text-xl px-12 py-6 h-auto bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium rounded-2xl"
            >
              Start Your Reading Journey
            </Button>
          </div>
          
          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <Card className="text-center bg-gradient-card shadow-soft border-0 p-6 hover:shadow-medium transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:shadow-glow transition-all duration-300">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl mb-4 text-foreground">Set Goals</CardTitle>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  Set personalized reading goals and track your progress throughout the year
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card className="text-center bg-gradient-card shadow-soft border-0 p-6 hover:shadow-medium transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:shadow-glow transition-all duration-300">
                  <Timer className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl mb-4 text-foreground">Track Time</CardTitle>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  Monitor your reading sessions and discover your reading speed patterns
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card className="text-center bg-gradient-card shadow-soft border-0 p-6 hover:shadow-medium transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:shadow-glow transition-all duration-300">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl mb-4 text-foreground">Analyze Progress</CardTitle>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  Get insights into your reading habits and earn rewards for your achievements
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
