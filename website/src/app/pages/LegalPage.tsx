import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { AlertTriangle, Shield, Eye, UserCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { updateMetaTags, resetMetaTags } from "../utils/seo";

export function LegalPage() {
  useEffect(() => {
    updateMetaTags(
      "Legal Disclaimer & Privacy",
      "Learn about our content policies, privacy practices, and terms of service at QuickStory.AI.",
      ["legal", "privacy", "terms", "content policy"],
      "library" // Pattern: Page Title | Quick
    );
    return () => resetMetaTags();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold mb-8">Legal Disclaimer & Privacy</h1>

      {/* Important Notice */}
      <Alert className="mb-8 border-amber-200 bg-amber-50">
        <AlertTriangle className="size-5 text-amber-600" />
        <AlertTitle className="text-amber-800">Important Notice</AlertTitle>
        <AlertDescription className="text-amber-700">
          By using QuickStory.AI, you acknowledge and agree that all content
          generated on this platform will be made publicly available for other
          users to read and enjoy. Please do not include private or personal
          information in your story requests.
        </AlertDescription>
      </Alert>

      {/* Content Sharing */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-5" />
            Content Sharing Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            QuickStory.AI is a community platform where parents share wonderful
            stories with each other. All stories generated on our platform are:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Publicly accessible to all users of the platform</li>
            <li>Searchable and discoverable through our story collections</li>
            <li>Available to be read, rated, and favorited by other parents</li>
            <li>
              Potentially featured in our "Top Stories" or "Trending" sections
            </li>
          </ul>
          <p className="font-medium text-purple-700">
            Please do not include any sensitive, private, or personally
            identifiable information in your story requests.
          </p>
        </CardContent>
      </Card>

      {/* Privacy & Personal Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Privacy & Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="font-medium text-lg">What NOT to Include:</h3>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Full names (first names only are recommended)</li>
            <li>Addresses, phone numbers, or email addresses</li>
            <li>Specific school names or locations</li>
            <li>
              Sensitive family information or personal circumstances
            </li>
            <li>Medical information or health conditions</li>
            <li>Financial information</li>
            <li>Any other personally identifiable information (PII)</li>
          </ul>

          <h3 className="font-medium text-lg mt-6">Best Practices:</h3>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Use only first names for characters</li>
            <li>Keep descriptions general and age-appropriate</li>
            <li>Focus on universal themes and experiences</li>
            <li>
              Remember that your stories will inspire other parents and children
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* AI Content Moderation */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            AI Content Moderation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            All stories generated on QuickStory.AI are subject to AI-powered
            content moderation to ensure:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Age-appropriate content for children</li>
            <li>No scary or disturbing content for young children</li>
            <li>No violence beyond mild adventure themes</li>
            <li>Positive and educational messaging</li>
            <li>Family-friendly language and scenarios</li>
          </ul>
          <p className="text-sm text-gray-600">
            While we strive to ensure all content is appropriate, parents should
            always review stories before reading them to their children.
          </p>
        </CardContent>
      </Card>

      {/* User Responsibilities */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="size-5" />
            User Responsibilities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>By using QuickStory.AI, you agree to:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              Not include private, personal, or sensitive information in story
              requests
            </li>
            <li>Use the platform responsibly and respectfully</li>
            <li>Not generate content that is harmful, offensive, or inappropriate</li>
            <li>Understand that all generated content becomes publicly available</li>
            <li>
              Report any concerning content through our moderation system
            </li>
            <li>
              Accept that QuickStory.AI is not responsible for user-generated
              content
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Copyright & Ownership */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Copyright & Content Ownership</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Stories generated on QuickStory.AI are created through AI technology
            based on user inputs. By generating a story, you:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              Grant QuickStory.AI the right to display, store, and share the
              generated content
            </li>
            <li>
              Acknowledge that the content may be viewed and enjoyed by other
              users
            </li>
            <li>
              Retain the right to delete stories from your personal library
              (though they may remain publicly accessible)
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Contact & Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Questions or Concerns?</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            If you have any questions about our legal disclaimer, privacy
            practices, or content policies, please contact us at{" "}
            <a
              href="mailto:legal@quickstory.ai"
              className="text-purple-600 hover:underline"
            >
              legal@quickstory.ai
            </a>
          </p>
          <p className="mt-4 text-sm text-gray-600">
            Last updated: February 17, 2026
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
