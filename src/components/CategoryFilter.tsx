import { Folder, GraduationCap, CreditCard, Heart, Scale, Trash2, FileText, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Category {
  value: string;
  label: string;
  icon: React.ReactNode;
  count: number;
}

interface CategoryFilterProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  documentCounts: { [key: string]: number };
}

const CategoryFilter = ({ selectedCategory, onCategoryChange, documentCounts }: CategoryFilterProps) => {
  const categories: Category[] = [
    {
      value: "all",
      label: "All Documents",
      icon: <Folder className="w-4 h-4" />,
      count: documentCounts.all || 0,
    },
    {
      value: "education",
      label: "Education",
      icon: <GraduationCap className="w-4 h-4" />,
      count: documentCounts.education || 0,
    },
    {
      value: "identity",
      label: "Identity",
      icon: <FileText className="w-4 h-4" />,
      count: documentCounts.identity || 0,
    },
    {
      value: "financial",
      label: "Financial",
      icon: <CreditCard className="w-4 h-4" />,
      count: documentCounts.financial || 0,
    },
    {
      value: "medical",
      label: "Medical",
      icon: <Heart className="w-4 h-4" />,
      count: documentCounts.medical || 0,
    },
    {
      value: "legal",
      label: "Legal",
      icon: <Scale className="w-4 h-4" />,
      count: documentCounts.legal || 0,
    },
    {
      value: "other",
      label: "Other",
      icon: <FileText className="w-4 h-4" />,
      count: documentCounts.other || 0,
    },
    {
      value: "private",
      label: "Private",
      icon: <Lock className="w-4 h-4" />,
      count: documentCounts.private || 0,
    },
  ];

  return (
    <div className="bg-gradient-to-br from-white to-gray-50/80 backdrop-blur-sm border-0 rounded-2xl p-6 h-fit shadow-xl">
      <div className="flex items-center mb-6">
        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <h3 className="font-bold text-gray-900 text-lg">Categories</h3>
      </div>
      <div className="space-y-3">
        {categories.map((category) => (
          <Button
            key={category.value}
            variant={selectedCategory === category.value ? "default" : "ghost"}
            className={`w-full justify-start text-left h-12 rounded-xl transition-all duration-200 ${
              selectedCategory === category.value
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                : "hover:bg-gray-100 text-gray-700 hover:text-gray-900 hover:shadow-md"
            }`}
            onClick={() => onCategoryChange(category.value)}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg mr-3 ${
                  selectedCategory === category.value
                    ? "bg-white/20"
                    : "bg-gray-100"
                }`}>
                  {category.icon}
                </div>
                <span className="font-medium">{category.label}</span>
              </div>
              <Badge
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  selectedCategory === category.value
                    ? "bg-white/20 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {category.count}
              </Badge>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default CategoryFilter;