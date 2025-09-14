import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Eye, 
  Download, 
  Printer, 
  Trash2, 
  MoreVertical, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Archive,
  RotateCcw
} from "lucide-react";

export interface TrashDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  url?: string;
  file?: File;
  category: string;
  deletedAt: string;
}

interface TrashDocumentCardProps {
  document: TrashDocument;
  onView: (document: TrashDocument) => void;
  onDownload: (document: TrashDocument) => void;
  onPrint: (document: TrashDocument) => void;
  onRestore: (id: string) => void;
  onDeletePermanent: (id: string) => void;
}

const getFileIcon = (type: string, name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return <ImageIcon className="w-12 h-12 text-purple-500" />;
  }
  if (type.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv'].includes(ext || '')) {
    return <Video className="w-12 h-12 text-red-500" />;
  }
  if (type.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac'].includes(ext || '')) {
    return <Music className="w-12 h-12 text-green-500" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
    return <Archive className="w-12 h-12 text-orange-500" />;
  }
  return <FileText className="w-12 h-12 text-blue-500" />;
};

const getPreviewContent = (document: TrashDocument) => {
  if (document.type.startsWith('image/')) {
    return (
      <img 
        src={document.url} 
        alt={document.name}
        className="w-full h-full object-cover"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          target.nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }
  
  return (
    <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100">
      {getFileIcon(document.type, document.name)}
    </div>
  );
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDeletedDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'Deleted yesterday';
  if (diffDays < 7) return `Deleted ${diffDays} days ago`;
  if (diffDays < 30) return `Deleted ${Math.ceil(diffDays / 7)} weeks ago`;
  return `Deleted on ${date.toLocaleDateString()}`;
};

const TrashDocumentCard = ({ 
  document, 
  onView, 
  onDownload, 
  onPrint, 
  onRestore, 
  onDeletePermanent 
}: TrashDocumentCardProps) => {
  const deletedDate = new Date(document.deletedAt);
  const now = new Date();
  const daysInTrash = Math.ceil((now.getTime() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, 30 - daysInTrash);
  
  return (
    <Card className="group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-0 bg-gradient-to-br from-red-50 to-red-100/50 backdrop-blur-sm shadow-lg rounded-2xl overflow-hidden animate-fade-in">
      <CardContent className="p-0">
        {/* Document Preview Area */}
        <div className="relative h-40 bg-gray-100 overflow-hidden cursor-pointer" onClick={() => onView(document)}>
          <div className="absolute inset-0 opacity-60">
            {getPreviewContent(document)}
          </div>
          
          {/* Trash overlay */}
          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
            <div className="bg-red-500/80 backdrop-blur-sm rounded-full p-2">
              <Trash2 className="w-6 h-6 text-white" />
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
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRestore(document.id);
                  }} 
                  className="text-green-600 rounded-lg"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeletePermanent(document.id);
                  }} 
                  className="text-red-600 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Forever
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Document Info Section */}
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate text-sm mb-1">
                {document.name}
              </h3>
              <div className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                  {document.category}
                </span>
                <span>{formatFileSize(document.size)}</span>
              </div>
              <p className="text-xs text-red-600 font-medium">
                {formatDeletedDate(document.deletedAt)}
              </p>
              {daysRemaining > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {daysRemaining} days until permanent deletion
                </p>
              )}
              {daysRemaining === 0 && (
                <p className="text-xs text-red-600 font-medium mt-1">
                  Will be permanently deleted soon
                </p>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-red-200">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRestore(document.id);
              }}
              className="text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300 rounded-lg flex-1 mr-2"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Restore
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDeletePermanent(document.id);
              }}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 rounded-lg flex-1 ml-2"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete Forever
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrashDocumentCard;
