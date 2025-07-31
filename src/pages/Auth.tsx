import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Mail } from "lucide-react";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          navigate("/dashboard");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`
          }
        });
        
        if (error) throw error;
        
        toast({
          title: "Check your email",
          description: "We sent you a confirmation link to complete your signup.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Authentication failed",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      
      if (error) throw error;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Authentication failed",
        description: error.message,
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-glow/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        {/* Logo Section */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="p-3 bg-gradient-primary rounded-2xl shadow-glow animate-glow-pulse">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <span className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              BRACK
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {isSignUp ? "Join BRACK" : "Welcome Back"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isSignUp 
                ? "Start your reading journey today" 
                : "Continue your reading adventure"
              }
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="bg-gradient-card shadow-medium border-0 animate-scale-in" style={{ animationDelay: '0.2s' }}>
          <CardContent className="p-6 space-y-6">
            <Button 
              onClick={handleGoogleAuth}
              disabled={loading}
              variant="outline" 
              className="w-full h-12 text-sm font-medium border-border/50 hover:shadow-soft transition-all duration-300"
            >
              <Mail className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/30" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground font-medium">
                  Or continue with email
                </span>
              </div>
            </div>
            
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-border/50 focus:border-primary transition-colors"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-border/50 focus:border-primary transition-colors"
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Loading...</span>
                  </div>
                ) : (
                  isSignUp ? "Create Account" : "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* Switch Mode */}
        <div className="text-center mt-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300 font-medium"
          >
            {isSignUp 
              ? "Already have an account? Sign in" 
              : "Don't have an account? Sign up"
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;