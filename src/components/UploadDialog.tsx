import { useState, useRef } from "react";
import { Upload, X, File, Sparkles, Loader2 } from "lucide-react";
import { Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { categorizeDocument, type CategorySuggestion } from "@/lib/geminiCategorization";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File, name: string, category: string, isPrivate: boolean) => void;
}

const categories = [
  { value: "education", label: "Education" },
  { value: "identity", label: "Identity" },
  { value: "financial", label: "Financial" },
  { value: "medical", label: "Medical" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
];

const UploadDialog = ({ open, onOpenChange, onUpload }: UploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestion | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setFile(file);
    setName(file.name.replace(/\.[^/.]+$/, ""));

    // Auto-categorize the document
    await analyzeDocument(file);
  };

  const analyzeDocument = async (file: File) => {
    setIsAnalyzing(true);
    setCategorySuggestion(null);

    try {
      const suggestion = await categorizeDocument(file.name);
      setCategorySuggestion(suggestion);

      // Auto-set category if confidence is high
      if (suggestion.confidence >= 0.7) {
        setCategory(suggestion.category);
        toast({
          title: "Smart Categorization",
          description: `Automatically categorized as '${categories.find(c => c.value === suggestion.category)?.label}' (${Math.round(suggestion.confidence * 100)}% confidence)`,
        });
      }
    } catch (error) {
      console.error("Error analyzing document:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applySuggestion = () => {
    if (categorySuggestion) {
      setCategory(categorySuggestion.category);
      toast({
        title: "Category Applied",
        description: `Set category to '${categories.find(c => c.value === categorySuggestion.category)?.label}'`,
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleUpload = () => {
    if (!file || !name || !category) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    onUpload(file, name, isPrivate ? "private" : category, isPrivate);

    // Reset form
    setFile(null);
    setName("");
    setCategory("");
    setIsPrivate(false);
    onOpenChange(false);

    toast({
      title: "Document Uploaded",
      description: `${name} has been uploaded successfully.`,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto bg-gradient-to-br from-white to-gray-50/80 backdrop-blur-sm border-0 shadow-2xl rounded-2xl z-[200]">
        <DialogHeader className="text-center pb-1">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold text-gray-900">Upload Document</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Upload your certificate or document with AI-powered smart categorization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 cursor-pointer ${isDragging
                ? "border-blue-400 bg-blue-50 scale-105"
                : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"
              }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />

            {file ? (
              <div className="flex items-center justify-center space-x-4 bg-white rounded-xl p-4 shadow-md">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <File className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-600">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setName("");
                  }}
                  className="hover:bg-red-100 text-red-500 rounded-xl"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div>
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Upload className="w-10 h-10 text-white" />
                </div>
                <p className="text-gray-900 font-semibold text-lg mb-2">Drop files here or click to browse</p>
                <p className="text-sm text-gray-600">
                  Supports PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                </p>
              </div>
            )}
          </div>

          {/* Document Name */}
          <div className="space-y-3">
            <Label htmlFor="documentName" className="text-gray-900 font-medium">Document Name</Label>
            <Input
              id="documentName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter document name"
              className="rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400 h-12"
            />
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="category">Category</Label>
              {isAnalyzing && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Analyzing...
                </div>
              )}
            </div>

            {/* AI Suggestion Banner */}
            {categorySuggestion && categorySuggestion.confidence < 0.7 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 space-y-3 shadow-md animate-scale-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-xl mr-3">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-blue-900 block">
                        AI Suggestion: {categories.find(c => c.value === categorySuggestion.category)?.label}
                      </span>
                      <span className="text-xs text-blue-600">
                        {Math.round(categorySuggestion.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={applySuggestion}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105"
                  >
                    Apply
                  </Button>
                </div>
                <p className="text-sm text-blue-800 bg-white/50 rounded-lg p-2">{categorySuggestion.reasoning}</p>
              </div>
            )}

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-xl border-gray-200 focus:border-blue-400 h-12">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-0 shadow-xl bg-white/95 backdrop-blur-md z-[9999]">
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value} className="rounded-lg">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="private"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="private" className="flex items-center space-x-1 text-sm font-medium text-gray-700">
              <Lock className="w-4 h-4" />
              <span>Private (requires biometric authentication)</span>
            </label>
          </div>

          {/* Upload Button */}
          <div className="flex justify-end space-x-3 pt-6">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-6 py-3 border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || !name || !category}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;