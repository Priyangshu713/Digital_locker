import { FileText, Download, Eye, Printer, Trash2, MoreVertical, File, Image, FileSpreadsheet, FileCode, FileImage, Play, Edit3, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/date-utils";

export interface Document {
  id: string;
  name: string;
  type: string;
  category: string;
  uploadDate: Date;
  size: string;
  file?: File;
  url?: string;
  path?: string;
}

interface DocumentCardProps {
  document: Document;
  onView: (doc: Document) => void;
  onDownload: (doc: Document) => void;
  onPrint: (doc: Document) => void;
  onShare?: (doc: Document) => void;
}

// Removed getDocumentIcon - now using getPreviewContent for document previews

const getCategoryColor = (category: string) => {
  const colors = {
    education: "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md",
    identity: "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md",
    financial: "bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-md",
    medical: "bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-md",
    legal: "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md",
    other: "bg-gradient-to-r from-gray-500 to-slate-600 text-white shadow-md",
    private: "bg-gradient-to-r from-black to-gray-800 text-white shadow-md",
  };
  return colors[category as keyof typeof colors] || colors.other;
};

const getPreviewContent = (document: Document) => {
  const fileType = document.type.toLowerCase();
  console.log('getPreviewContent called for:', document.name, 'type:', fileType);
  
  // For PDFs
  if (fileType === 'pdf') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-100 to-red-200">
        <FileText className="w-16 h-16 text-red-600 mb-2" />
        <span className="text-sm font-bold text-red-700">PDF</span>
      </div>
    );
  }
  
  // For images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType)) {
    if (document.url) {
      // Create a URL with a timestamp to prevent caching issues
      const imageUrl = new URL(document.url);
      imageUrl.searchParams.set('t', Date.now().toString());
      
      return (
        <div className="w-full h-full relative">
          <img 
            src={imageUrl.toString()}
            alt={document.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error('Error loading image:', document.name, 'URL:', document.url);
              const target = e.currentTarget;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
            onLoad={() => {
              console.log('Successfully loaded image:', document.name);
            }}
          />
          <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200" style={{display: 'none'}}>
            <FileImage className="w-16 h-16 text-blue-600 mb-2" />
            <span className="text-sm font-bold text-blue-700">IMAGE</span>
            <span className="text-xs text-gray-500 mt-1">{document.name}</span>
          </div>
        </div>
      );
    } else {
      console.warn('No URL provided for image:', document.name);
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
          <FileImage className="w-16 h-16 text-blue-600 mb-2" />
          <span className="text-sm font-bold text-blue-700">IMAGE</span>
          <span className="text-xs text-gray-500 mt-1">{document.name}</span>
        </div>
      );
    }
  }
  
  // For Word documents
  if (['doc', 'docx'].includes(fileType)) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
        <FileText className="w-16 h-16 text-blue-600 mb-2" />
        <span className="text-sm font-bold text-blue-700">DOC</span>
      </div>
    );
  }
  
  // For Excel files
  if (['xlsx', 'xls'].includes(fileType)) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-green-100 to-green-200">
        <FileSpreadsheet className="w-16 h-16 text-green-600 mb-2" />
        <span className="text-sm font-bold text-green-700">EXCEL</span>
      </div>
    );
  }
  
  // Default fallback
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200">
      <File className="w-16 h-16 text-purple-600 mb-2" />
      <span className="text-sm font-bold text-purple-700">{fileType.toUpperCase()}</span>
    </div>
  );
};

const DocumentCard = ({ document, onView, onDownload, onPrint, onShare }: DocumentCardProps) => {
  console.log('DocumentCard rendering for:', document.name, 'type:', document.type);
  
  return (
    <Card className="group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm shadow-lg rounded-3xl overflow-hidden animate-fade-in">
      <CardContent className="p-0">
        {/* Document Preview Area */}
        <div className="relative h-40 bg-gray-100 overflow-hidden cursor-pointer" onClick={() => onView(document)}>
          <div className="absolute inset-0">
            {getPreviewContent(document)}
          </div>
          
          {/* Overlay with play/view icon */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg">
              <Eye className="w-6 h-6 text-gray-700" />
            </div>
          </div>
          
          {/* Quick actions overlay */}
          <div className="absolute top-3 right-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 bg-white/90 hover:bg-white rounded-xl transition-all shadow-md">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl shadow-xl border-0 bg-white/95 backdrop-blur-md">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onView(document);
                  }} 
                  className="rounded-lg"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDownload(document);
                  }} 
                  className="rounded-lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPrint(document);
                  }} 
                  className="rounded-lg"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </DropdownMenuItem>
                {onShare && (
                  <div className="relative">
                    <DropdownMenuItem 
                      onClick={(e) => {
                        if (document.category === 'private') {
                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        onShare(document);
                      }} 
                      className={`rounded-lg ${document.category === 'private' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={document.category === 'private'}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                      {document.category === 'private' && (
                        <div className="absolute left-0 right-0 -top-8 bg-gray-800 text-white text-xs p-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                          Private documents cannot be shared
                        </div>
                      )}
                    </DropdownMenuItem>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Document Info Section */}
        <div className="p-4">
          {/* Title and Category */}
          <div className="mb-3">
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors text-lg mb-2" title={document.name}>
              {document.name}
            </h3>
            <div className="flex items-center justify-between">
              <Badge className={`${getCategoryColor(document.category)} px-3 py-1 rounded-full text-xs font-medium`}>
                {document.category.charAt(0).toUpperCase() + document.category.slice(1)}
              </Badge>
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <span>{document.size}</span>
              </div>
            </div>
          </div>
          
          {/* Upload date and actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-sm text-gray-600">Uploaded {formatDate(document.uploadDate)}</span>
            
            {/* Action buttons - always visible on mobile */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(document)}
                className="h-9 px-4 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 rounded-2xl transition-all hover:scale-105"
              >
                <Eye className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">View</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(document)}
                className="h-9 px-4 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 rounded-2xl transition-all hover:scale-105"
              >
                <Download className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentCard;