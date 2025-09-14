import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Share2, Copy, Check, Link, Clock, Eye, EyeOff } from "lucide-react";
import { Document } from './DocumentCard';
import { toast } from "@/hooks/use-toast";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  onShare: (document: Document, shareSettings: ShareSettings) => Promise<string>;
}

export interface ShareSettings {
  isPublic: boolean;
  expiresIn: number; // hours, 0 = no expiration
  requiresPassword: boolean;
  password?: string;
  allowDownload: boolean;
}

const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  document,
  onShare
}) => {
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    isPublic: true,
    expiresIn: 24, // 24 hours default
    requiresPassword: false,
    password: '',
    allowDownload: true
  });
  const [shareLink, setShareLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShareLink('');
      setIsCopied(false);
      setShareSettings({
        isPublic: true,
        expiresIn: 24,
        requiresPassword: false,
        password: '',
        allowDownload: true
      });
    }
  }, [isOpen]);

  const generateShareLink = async () => {
    if (!document) return;

    setIsGenerating(true);
    try {
      const link = await onShare(document, shareSettings);
      setShareLink(link);
    } catch (error) {
      console.error('Error generating share link:', error);
      toast({
        title: "Error",
        description: "Failed to generate share link. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setIsCopied(true);
      toast({
        title: "Copied!",
        description: "Share link copied to clipboard.",
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Error",
        description: "Failed to copy link to clipboard.",
        variant: "destructive"
      });
    }
  };

  const expirationOptions = [
    { value: 1, label: '1 hour' },
    { value: 24, label: '24 hours' },
    { value: 168, label: '7 days' },
    { value: 720, label: '30 days' },
    { value: 0, label: 'Never expires' }
  ];

  // Prevent sharing of private documents
  if (document?.category === 'private') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-blue-600" />
              Cannot Share Private Document
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <EyeOff className="h-5 w-5 text-red-500" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    Private documents cannot be shared. If you need to share this document, 
                    please move it out of the private folder first.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            Share Document
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {document && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="font-medium text-gray-900">{document.name}</p>
              <p className="text-sm text-gray-600">{document.type.toUpperCase()} • {document.size}</p>
            </div>
          )}

          {/* Share Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Public Access</Label>
                <p className="text-sm text-gray-600">Anyone with the link can access</p>
              </div>
              <Switch
                checked={shareSettings.isPublic}
                onCheckedChange={(checked) => 
                  setShareSettings(prev => ({ ...prev, isPublic: checked }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Link Expiration</Label>
              <div className="grid grid-cols-2 gap-2">
                {expirationOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={shareSettings.expiresIn === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShareSettings(prev => ({ ...prev, expiresIn: option.value }))}
                    className="justify-start"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Password Protection</Label>
                <p className="text-sm text-gray-600">Require password to access</p>
              </div>
              <Switch
                checked={shareSettings.requiresPassword}
                onCheckedChange={(checked) => 
                  setShareSettings(prev => ({ ...prev, requiresPassword: checked, password: checked ? prev.password : '' }))
                }
              />
            </div>

            {shareSettings.requiresPassword && (
              <div className="space-y-2">
                <Label htmlFor="share-password">Password</Label>
                <Input
                  id="share-password"
                  type="password"
                  value={shareSettings.password}
                  onChange={(e) => setShareSettings(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Allow Download</Label>
                <p className="text-sm text-gray-600">Users can download the file</p>
              </div>
              <Switch
                checked={shareSettings.allowDownload}
                onCheckedChange={(checked) => 
                  setShareSettings(prev => ({ ...prev, allowDownload: checked }))
                }
              />
            </div>
          </div>

          {/* Generated Link */}
          {shareLink && (
            <div className="space-y-2">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                  className="shrink-0"
                >
                  {isCopied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  {shareSettings.isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {shareSettings.isPublic ? 'Public' : 'Private'}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {shareSettings.expiresIn === 0 ? 'Never expires' : `Expires in ${shareSettings.expiresIn}h`}
                </div>
                {shareSettings.requiresPassword && (
                  <div className="flex items-center gap-1">
                    <span>🔒 Password protected</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
          {!shareLink ? (
            <Button
              onClick={generateShareLink}
              disabled={isGenerating || !shareSettings.isPublic || (shareSettings.requiresPassword && !shareSettings.password)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4 mr-2" />
                  Generate Link
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={copyToClipboard}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
