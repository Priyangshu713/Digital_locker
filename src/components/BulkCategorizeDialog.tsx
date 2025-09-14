import { useState } from "react";
import { Sparkles, Loader2, Check, X, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { bulkCategorizeDocuments, categoryMapping } from "@/lib/geminiCategorization";

interface Document {
  name: string;
  path: string;
  category: string;
  publicUrl: string;
  size: number;
}

interface CategorySuggestionResult {
  path: string;
  suggestedCategory: string;
  confidence: number;
  reasoning: string;
  currentCategory: string;
  name: string;
}

interface BulkCategorizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: Document[];
  onUpdateCategories: (updates: Array<{ path: string; category: string }>) => void;
}

const BulkCategorizeDialog = ({ 
  open, 
  onOpenChange, 
  documents, 
  onUpdateCategories 
}: BulkCategorizeDialogProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [suggestions, setSuggestions] = useState<CategorySuggestionResult[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  const categories = [
    { value: "education", label: "Education" },
    { value: "identity", label: "Identity" },
    { value: "financial", label: "Financial" },
    { value: "medical", label: "Medical" },
    { value: "legal", label: "Legal" },
    { value: "other", label: "Other" },
  ];

  const getCategoryLabel = (value: string) => {
    return categories.find(cat => cat.value === value)?.label || value;
  };

  const analyzeAllDocuments = async () => {
    setIsAnalyzing(true);
    setProgress(0);
    setSuggestions([]);
    setSelectedSuggestions(new Set());

    try {
      const results = await bulkCategorizeDocuments(documents);
      
      const suggestionsWithMetadata = results.map(result => {
        const doc = documents.find(d => d.path === result.path);
        return {
          ...result,
          currentCategory: doc?.category || "other",
          name: doc?.name || "Unknown"
        };
      }).filter(suggestion => 
        // Only show suggestions where the category would change and confidence is reasonable
        suggestion.suggestedCategory !== suggestion.currentCategory && 
        suggestion.confidence >= 0.5
      );

      setSuggestions(suggestionsWithMetadata);
      
      if (suggestionsWithMetadata.length === 0) {
        toast({
          title: "Analysis Complete",
          description: "No categorization improvements found. Your documents are already well organized!",
        });
      } else {
        toast({
          title: "Analysis Complete",
          description: `Found ${suggestionsWithMetadata.length} categorization suggestions.`,
        });
      }
    } catch (error) {
      console.error("Error analyzing documents:", error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setProgress(100);
    }
  };

  const toggleSuggestion = (path: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedSuggestions(newSelected);
  };

  const selectAll = () => {
    setSelectedSuggestions(new Set(suggestions.map(s => s.path)));
  };

  const selectNone = () => {
    setSelectedSuggestions(new Set());
  };

  const applySelectedSuggestions = () => {
    const updates = suggestions
      .filter(s => selectedSuggestions.has(s.path))
      .map(s => ({
        path: s.path,
        category: s.suggestedCategory
      }));

    if (updates.length > 0) {
      onUpdateCategories(updates);
      toast({
        title: "Categories Updated",
        description: `Updated ${updates.length} document${updates.length > 1 ? 's' : ''}.`,
      });
      onOpenChange(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-500";
    if (confidence >= 0.6) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-blue-600" />
            Smart Document Categorization
          </DialogTitle>
          <DialogDescription>
            Use AI to automatically categorize your documents for better organization.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Analysis Controls */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Analyze {documents.length} documents</p>
              <p className="text-sm text-muted-foreground">
                AI will suggest better categories for your documents
              </p>
            </div>
            <Button 
              onClick={analyzeAllDocuments}
              disabled={isAnalyzing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analyze Documents
                </>
              )}
            </Button>
          </div>

          {/* Progress Bar */}
          {isAnalyzing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analyzing documents...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Suggestions List */}
          {suggestions.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">
                  Categorization Suggestions ({suggestions.length})
                </h3>
                <div className="space-x-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>
                    Select None
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.path}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedSuggestions.has(suggestion.path)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => toggleSuggestion(suggestion.path)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className={`w-3 h-3 rounded-full ${
                            selectedSuggestions.has(suggestion.path) 
                              ? "bg-blue-500" 
                              : "border-2 border-gray-300"
                          }`} />
                          <h4 className="font-medium truncate">{suggestion.name}</h4>
                        </div>
                        
                        <div className="flex items-center space-x-4 mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">Current:</span>
                            <Badge variant="outline">
                              {getCategoryLabel(suggestion.currentCategory)}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">Suggested:</span>
                            <Badge className="bg-blue-100 text-blue-800">
                              {getCategoryLabel(suggestion.suggestedCategory)}
                            </Badge>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          {suggestion.reasoning}
                        </p>
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">Confidence:</span>
                          <div className="flex items-center space-x-1">
                            <div className={`w-2 h-2 rounded-full ${getConfidenceColor(suggestion.confidence)}`} />
                            <span className="text-xs font-medium">
                              {Math.round(suggestion.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {suggestions.length > 0 && (
              <Button 
                onClick={applySelectedSuggestions}
                disabled={selectedSuggestions.size === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Apply {selectedSuggestions.size} Suggestion{selectedSuggestions.size !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkCategorizeDialog;
