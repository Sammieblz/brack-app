import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuestionMark, Mail, ChatBubble, Notes } from "iconoir-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export const SupportContact = () => {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState({
    subject: "",
    message: "",
  });

  const handleSubmitFeedback = () => {
    // TODO: Implement feedback submission
    toast({
      title: "Feedback submitted",
      description: "Thank you for your feedback! We'll review it soon.",
    });
    setFeedback({ subject: "", message: "" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Support & Help</h2>
        <p className="font-sans text-muted-foreground mt-1">
          Get help and share your feedback
        </p>
      </div>

      {/* FAQs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QuestionMark className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-sans font-medium mb-1">How do I reset my password?</h4>
              <p className="font-sans text-sm text-muted-foreground">
                Go to Account Settings and click "Send Password Reset Email"
              </p>
            </div>
            <div>
              <h4 className="font-sans font-medium mb-1">How do I delete my account?</h4>
              <p className="font-sans text-sm text-muted-foreground">
                Go to Account Management in Settings and click "Delete Account"
              </p>
            </div>
            <div>
              <h4 className="font-sans font-medium mb-1">How do I export my data?</h4>
              <p className="font-sans text-sm text-muted-foreground">
                Go to Account Management and click "Export My Data"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Contact Support
          </CardTitle>
          <CardDescription>
            Send us a message and we'll get back to you as soon as possible
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={feedback.subject}
              onChange={(e) => setFeedback(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="What can we help you with?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={feedback.message}
              onChange={(e) => setFeedback(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Describe your issue or question..."
              rows={6}
            />
          </div>
          <Button onClick={handleSubmitFeedback} className="w-full">
            <ChatBubble className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Notes className="h-5 w-5" />
            Share Feedback
          </CardTitle>
          <CardDescription>
            Help us improve Brack by sharing your thoughts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback_subject">Subject</Label>
            <Input
              id="feedback_subject"
              value={feedback.subject}
              onChange={(e) => setFeedback(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Feature request, bug report, or suggestion"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback_message">Feedback</Label>
            <Textarea
              id="feedback_message"
              value={feedback.message}
              onChange={(e) => setFeedback(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Tell us what you think..."
              rows={6}
            />
          </div>
          <Button onClick={handleSubmitFeedback} variant="outline" className="w-full">
            <Notes className="h-4 w-4 mr-2" />
            Submit Feedback
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
