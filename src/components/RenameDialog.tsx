import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit3, Loader2 } from "lucide-react";
import { Document } from './DocumentCard';

interface RenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  onRename: (document: Document, newName: string) => Promise<void>;
}

const RenameDialog: React.FC<RenameDialogProps> = ({
  isOpen,
  onClose,
  document,
  onRename
}) => {
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (document && isOpen) {
      // Remove file extension for editing
      const nameWithoutExtension = document.name.replace(/\.[^/.]+$/, '');
      setNewName(nameWithoutExtension);
    }
  }, [document, isOpen]);

  const handleRename = async () => {
    if (!document || !newName.trim()) return;
    
    // Prevent renaming private documents
    if (document.category === 'private') {
      return;
    }

    setIsRenaming(true);
    try {
      // Get the original file extension
      const extension = document.name.split('.').pop();
      const finalName = extension ? `${newName.trim()}.${extension}` : newName.trim();
      
      await onRename(document, finalName);
      onClose();
    } catch (error) {
      console.error('Error renaming document:', error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-600" />
            Rename Document
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="document-name">Document Name</Label>
            <Input
              id="document-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter new document name"
              className="w-full"
              autoFocus
              disabled={document?.category === 'private'}
            />
            {document?.category === 'private' && (
              <p className="text-sm text-red-600 mt-1">
                Private documents cannot be renamed
              </p>
            )}
          </div>
          
          {document && (
            <div className="text-sm text-gray-600">
              <p><strong>Current name:</strong> {document.name}</p>
              <p><strong>File type:</strong> {document.type?.toUpperCase() || 'UNKNOWN'}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isRenaming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            disabled={isRenaming || !newName.trim() || document?.category === 'private'}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRenaming ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Renaming...
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 mr-2" />
                Rename
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RenameDialog;
