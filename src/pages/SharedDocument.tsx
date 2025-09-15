import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Eye, Download, Lock, Clock, FileText, Loader2 } from 'lucide-react';

// Add screenshot protection styles
const screenshotProtectionStyles = `
  @keyframes screenshot-protection {
    0% { background-position: 0 0; }
    100% { background-position: 40px 40px; }
  }
  
  .screenshot-protected {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-app-region: no-drag;
  }
  
  .screenshot-protected::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(255, 255, 255, 0.01) 10px,
      rgba(255, 255, 255, 0.01) 20px
    );
    pointer-events: none;
    z-index: 999;
  }
`;

interface SharedDocumentData {
  id: string;
  user_id: string;
  document_path: string;
  share_token: string;
  is_public: boolean;
  expires_at: string | null;
  password_hash: string | null;
  allow_download: boolean;
  access_count: number;
  created_at: string;
}

const SharedDocument: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  
  const [shareData, setShareData] = useState<SharedDocumentData | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  // Add screenshot protection CSS to document head
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = screenshotProtectionStyles;
    document.head.appendChild(styleElement);

    // Screenshot detection and prevention
    const preventScreenshot = () => {
      // Detect screenshot attempts
      document.addEventListener('keydown', (e) => {
        // Prevent common screenshot shortcuts
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
          e.preventDefault();
          toast({
            title: "Screenshot Blocked",
            description: "Screenshots are not allowed for this protected document.",
            variant: "destructive"
          });
        }
        // Prevent Print Screen
        if (e.key === 'PrintScreen') {
          e.preventDefault();
          toast({
            title: "Screenshot Blocked", 
            description: "Screenshots are not allowed for this protected document.",
            variant: "destructive"
          });
        }
      });

      // Detect when window loses focus (potential screenshot)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // Blur content when window is not visible
          const protectedElements = document.querySelectorAll('.screenshot-protected');
          protectedElements.forEach((el) => {
            (el as HTMLElement).style.filter = 'blur(10px)';
          });
        } else {
          // Restore content when window is visible
          const protectedElements = document.querySelectorAll('.screenshot-protected');
          protectedElements.forEach((el) => {
            (el as HTMLElement).style.filter = 'none';
          });
        }
      });
    };

    if (!shareData?.allow_download) {
      preventScreenshot();
    }

    return () => {
      document.head.removeChild(styleElement);
    };
  }, [shareData?.allow_download]);

  useEffect(() => {
    if (token) {
      loadSharedDocument();
    }
  }, [token]);

  const loadSharedDocument = async () => {
    try {
      setLoading(true);
      console.log('Loading shared document with token:', token);
      
      // Try multiple approaches to fetch share data
      let shareInfo = null;
      let shareError = null;

      // First attempt: Standard query
      const { data: shareData1, error: error1 } = await supabase
        .from('document_shares')
        .select('*')
        .eq('share_token', token)
        .single();

      if (error1) {
        console.log('First attempt failed:', error1);
        
        // Second attempt: Without single() to see if record exists
        const { data: shareData2, error: error2 } = await supabase
          .from('document_shares')
          .select('*')
          .eq('share_token', token);

        if (error2) {
          console.log('Second attempt failed:', error2);
          shareError = error2;
        } else if (shareData2 && shareData2.length > 0) {
          shareInfo = shareData2[0];
          console.log('Found share record:', shareInfo);
        } else {
          console.log('No records found for token:', token);
          setError('Share link not found. Please check if the link is correct.');
          return;
        }
      } else {
        shareInfo = shareData1;
        console.log('Share record found on first attempt:', shareInfo);
      }

      if (!shareInfo) {
        console.log('No share info available');
        setError('Share link not found or has been removed.');
        return;
      }

      // Check if share is public
      if (!shareInfo.is_public) {
        console.log('Share is not public');
        setError('This document is not publicly accessible.');
        return;
      }

      // Check if share has expired
      if (shareInfo.expires_at && new Date(shareInfo.expires_at) < new Date()) {
        console.log('Share has expired:', shareInfo.expires_at);
        setError('This share link has expired.');
        return;
      }

      // Check if password is required
      if (shareInfo.password_hash) {
        console.log('Password is required for this share');
        setPasswordRequired(true);
        setShareData(shareInfo);
        return;
      }

      console.log('Loading document for share:', shareInfo.document_path);
      // Load document if no password required
      await loadDocument(shareInfo);
      
    } catch (error) {
      console.error('Error loading shared document:', error);
      setError(`Failed to load shared document: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadDocument = async (shareInfo: SharedDocumentData) => {
    try {
      console.log('Attempting to load document from path:', shareInfo.document_path);
      
      // First, check if the file exists in storage
      const { data: fileList, error: listError } = await supabase.storage
        .from('documents')
        .list('', {
          search: shareInfo.document_path.split('/').pop() // Get filename
        });

      if (listError) {
        console.error('Error listing files:', listError);
      } else {
        console.log('Files found in storage:', fileList);
      }

      // Try to get the document URL from Supabase storage
      const { data: urlData, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(shareInfo.document_path, 3600); // 1 hour expiry

      if (urlError) {
        console.error('Storage error details:', urlError);
        
        // Try alternative path formats
        const alternativePaths = [
          shareInfo.document_path,
          shareInfo.document_path.replace(/^\/+/, ''), // Remove leading slashes
          `${shareInfo.user_id}/${shareInfo.document_path.split('/').pop()}`, // user_id/filename
        ];

        let successfulUrl = null;
        
        for (const altPath of alternativePaths) {
          console.log('Trying alternative path:', altPath);
          const { data: altUrlData, error: altError } = await supabase.storage
            .from('documents')
            .createSignedUrl(altPath, 3600);
          
          if (!altError && altUrlData) {
            console.log('Success with alternative path:', altPath);
            successfulUrl = altUrlData.signedUrl;
            break;
          } else {
            console.log('Alternative path failed:', altPath, altError);
          }
        }

        if (!successfulUrl) {
          setError('Document file not found in storage. The file may have been moved or deleted.');
          return;
        }

        setDocumentUrl(successfulUrl);
      } else {
        console.log('Document URL generated successfully:', urlData.signedUrl);
        setDocumentUrl(urlData.signedUrl);
      }

      setShareData(shareInfo);

      // Try to increment access count (may fail due to RLS, but that's okay)
      try {
        await supabase
          .from('document_shares')
          .update({ 
            access_count: shareInfo.access_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', shareInfo.id);
      } catch (updateError) {
        console.warn('Could not update access count:', updateError);
        // Continue anyway, this is not critical
      }

    } catch (error) {
      console.error('Error loading document:', error);
      setError(`Failed to load document content: ${error.message}`);
    }
  };

  const getDocumentName = () => {
    if (!shareData) return 'Document';
    return shareData.document_path.split('/').pop() || 'Document';
  };

  const getExpirationText = () => {
    if (!shareData?.expires_at) return 'Never expires';
    const expiryDate = new Date(shareData.expires_at);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Expires soon';
    if (diffHours < 24) return `Expires in ${diffHours} hours`;
    const diffDays = Math.ceil(diffHours / 24);
    return `Expires in ${diffDays} days`;
  };

  const verifyPassword = async () => {
    if (!shareData || !password) return;

    setVerifyingPassword(true);
    try {
      // Simple password verification (in production, use proper hashing)
      const hashedInput = btoa(password);
      
      if (hashedInput === shareData.password_hash) {
        setPasswordRequired(false);
        await loadDocument(shareData);
        toast({
          title: "Access Granted",
          description: "Password verified successfully.",
        });
      } else {
        toast({
          title: "Invalid Password",
          description: "The password you entered is incorrect.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      toast({
        title: "Error",
        description: "Failed to verify password.",
        variant: "destructive"
      });
    } finally {
      setVerifyingPassword(false);
    }
  };

  const downloadDocument = async () => {
    if (!shareData || !shareData.allow_download) return;

    try {
      console.log('Attempting to download document from path:', shareData.document_path);
      
      // Try multiple path formats for download, similar to loadDocument
      const alternativePaths = [
        shareData.document_path,
        shareData.document_path.replace(/^\/+/, ''), // Remove leading slashes
        `${shareData.user_id}/${shareData.document_path.split('/').pop()}`, // user_id/filename
      ];

      let downloadSuccess = false;
      
      for (const altPath of alternativePaths) {
        try {
          console.log('Trying download path:', altPath);
          const { data, error } = await supabase.storage
            .from('documents')
            .download(altPath);

          if (error) {
            console.log('Download failed for path:', altPath, error);
            continue;
          }

          console.log('Download successful for path:', altPath);
          
          // Create download link
          const url = URL.createObjectURL(data);
          const a = document.createElement('a');
          a.href = url;
          a.download = shareData.document_path.split('/').pop() || 'document';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          downloadSuccess = true;
          break;
        } catch (pathError) {
          console.log('Path attempt failed:', altPath, pathError);
          continue;
        }
      }

      if (downloadSuccess) {
        toast({
          title: "Download Started",
          description: "Document download has begun.",
        });
      } else {
        throw new Error('All download paths failed');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Download Failed",
        description: "Could not download document. The file may have been moved or deleted.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shared document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to DigiLocker
          </button>
        </div>
      </div>
    );
  }

  if (passwordRequired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 text-yellow-600 mx-auto mb-2" />
            <CardTitle>Password Required</CardTitle>
            <p className="text-gray-600">This document is password protected</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && verifyPassword()}
                className="w-full"
              />
            </div>
            <Button 
              onClick={verifyPassword}
              disabled={!password || verifyingPassword}
              className="w-full bg-yellow-600 hover:bg-yellow-700"
            >
              {verifyingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Access Document'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{getDocumentName()}</h1>
                <p className="text-sm text-gray-500">Shared document</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 flex-shrink-0">
              <div className="text-sm text-gray-500 flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span className="whitespace-nowrap">{getExpirationText()}</span>
              </div>
              {shareData?.allow_download && (
                <Button
                  onClick={downloadDocument}
                  variant="outline"
                  size="sm"
                  className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 whitespace-nowrap"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document Viewer */}
      <div className="w-full px-4 py-4">
        <Card className="bg-white shadow-lg max-w-full">
          <CardContent className="p-0">
            {documentUrl ? (
              shareData?.allow_download ? (
                <div className="w-full h-[calc(100vh-180px)] overflow-hidden">
                  <iframe
                    src={documentUrl}
                    className="w-full h-full border-0 rounded-lg"
                    title={getDocumentName()}
                  />
                </div>
              ) : (
                <div 
                  className="w-full h-[calc(100vh-180px)] overflow-hidden relative screenshot-protected"
                  style={{ 
                    filter: 'none',
                    WebkitFilter: 'none'
                  }}
                  onLoad={() => {
                    // Apply screenshot protection
                    const protectedDiv = document.querySelector('.screenshot-protected') as HTMLElement;
                    if (protectedDiv) {
                      protectedDiv.style.cssText += `
                        -webkit-touch-callout: none;
                        -webkit-user-select: none;
                        -khtml-user-select: none;
                        -moz-user-select: none;
                        -ms-user-select: none;
                        user-select: none;
                        -webkit-app-region: no-drag;
                        content-visibility: auto;
                        contain: layout style paint;
                      `;
                    }
                  }}
                >
                  <iframe
                    src={`${documentUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-full border-0 rounded-lg screenshot-blocked"
                    title={getDocumentName()}
                    style={{
                      filter: 'none',
                      WebkitFilter: 'none'
                    }}
                    onLoad={() => {
                      // Attempt to hide browser PDF controls and add screenshot protection
                      try {
                        const iframe = document.querySelector('iframe.screenshot-blocked') as HTMLIFrameElement;
                        if (iframe && iframe.contentDocument) {
                          const style = iframe.contentDocument.createElement('style');
                          style.textContent = `
                            .toolbar, .findbar, .secondaryToolbar { display: none !important; }
                            .download, .print { display: none !important; }
                            body, html, * { 
                              -webkit-touch-callout: none !important;
                              -webkit-user-select: none !important;
                              -khtml-user-select: none !important;
                              -moz-user-select: none !important;
                              -ms-user-select: none !important;
                              user-select: none !important;
                              -webkit-app-region: no-drag !important;
                            }
                          `;
                          iframe.contentDocument.head.appendChild(style);
                        }
                      } catch (e) {
                        console.log('Cannot modify iframe content due to CORS');
                      }
                    }}
                  />
                  {/* Anti-screenshot overlay with dynamic content */}
                  <div 
                    className="absolute inset-0 bg-transparent pointer-events-none"
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                      background: 'linear-gradient(45deg, transparent 49%, rgba(255,255,255,0.01) 50%, transparent 51%)',
                      backgroundSize: '20px 20px',
                      animation: 'screenshot-protection 2s linear infinite'
                    }}
                  />
                  {/* Invisible watermark elements */}
                  <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                    {Array.from({ length: 50 }, (_, i) => (
                      <div
                        key={i}
                        className="absolute text-xs opacity-5 select-none"
                        style={{
                          top: `${Math.random() * 100}%`,
                          left: `${Math.random() * 100}%`,
                          transform: `rotate(${Math.random() * 360}deg)`,
                          color: '#000000',
                          fontSize: '8px',
                          fontWeight: 'bold',
                          zIndex: 1000,
                          pointerEvents: 'none'
                        }}
                      >
                        PROTECTED
                      </div>
                    ))}
                  </div>
                  {/* Warning message */}
                  <div className="absolute top-4 right-4 bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm z-50">
                    <Lock className="w-4 h-4 inline mr-1" />
                    Screenshot Protected
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Document preview not available</p>
                  {shareData?.allow_download && (
                    <Button
                      onClick={downloadDocument}
                      className="mt-4 bg-blue-600 hover:bg-blue-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Document
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="bg-white border-t">
        <div className="w-full px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500 gap-2">
            <p>Shared via DigiLocker</p>
            <p>Viewed {shareData?.access_count || 0} times</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedDocument;
