import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listUserDocuments, moveToTrash, restoreFromTrash, listUserTrash, deletePermanent, getUserSmartFolders, getDocumentFolderAssignments, createSmartFolder, assignDocumentToFolder, uploadDocument, supabase } from '../lib/supabaseClient';
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { Grid, List, Filter, Sparkles, Upload, Loader2, Folder, FolderOpen, Edit3, Check, X } from "lucide-react";
import Header from "@/components/Header";
import DocumentCard, { Document } from "@/components/DocumentCard";
import TrashDocumentCard, { TrashDocument } from "@/components/TrashDocumentCard";
import UploadDialog from "@/components/UploadDialog";
import CategoryFilter from "@/components/CategoryFilter";
import BulkCategorizeDialog from "@/components/BulkCategorizeDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { categorizeDocument, bulkCategorizeDocuments, getSubcategoryName, findBestMatchingFolder } from '../lib/geminiCategorization';
import RenameDialog from '@/components/RenameDialog';
import ShareDialog, { ShareSettings } from '@/components/ShareDialog';
import '../styles/animations.css';
import '../styles/toast-fix.css';

const Index = () => {
  const { user } = useAuth();
  const { isSupported, authenticateUser, registerCredential } = useWebAuthn();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [trashDocs, setTrashDocs] = useState<TrashDocument[]>([]);
  
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [bulkCategorizeOpen, setBulkCategorizeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, _setSelectedCategory] = useState("all");

  // wrapper to auth when selecting "private" category
  const handleCategoryChange = async (cat: string) => {
    if (cat === 'private') {
      const ok = await requireAuth({ category: 'private' } as Document);
      if (!ok) return;
    }
    _setSelectedCategory(cat);
  }
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [smartFoldersMode, setSmartFoldersMode] = useState(false);
  const [smartFolders, setSmartFolders] = useState<{[key: string]: Document[]}>({});
  const [isAnalyzingFolders, setIsAnalyzingFolders] = useState(false);
  const [persistentFolders, setPersistentFolders] = useState<any[]>([]);
  const [folderAssignments, setFolderAssignments] = useState<any[]>([]);
  
  // Rename and Share dialog states
  const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; document: Document | null }>({
    isOpen: false,
    document: null
  });
  const [shareDialog, setShareDialog] = useState<{ isOpen: boolean; document: Document | null }>({
    isOpen: false,
    document: null
  });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadDocuments();
      loadPersistentFolders();
    }
  }, [user]);
  
  useEffect(() => {
    if (user && documents.length > 0 && persistentFolders.length > 0) {
      loadPersistentFolders();
    }
  }, [documents, persistentFolders.length]);

  const loadDocuments = async () => {
    if (!user) return;
    try {
      setLoadingDocs(true);
      const docs = await listUserDocuments(user.id);
      console.log('Loaded documents:', docs.map(d => ({ name: d.name, path: d.path })));
      const trash = await listUserTrash(user.id);
      console.log('Loaded trash:', trash.map(t => ({ name: t.name, path: t.path })));
      setDocuments(
        docs.map((d) => {
          const doc = {
            id: d.path,
            name: d.name,
            type: d.name.split('.').pop() || 'unknown',
            category: d.category,
            uploadDate: new Date(),
            size: `${(d.size / (1024 * 1024)).toFixed(1)} MB`,
            url: d.publicUrl,
            path: d.path,
          };
          console.log('Processed document:', doc);
          return doc;
        })
      );
    } catch (e) {
      console.error(e);
    } finally {
      // fetch trash too
      const trashData = await listUserTrash(user.id);
      setTrashDocs(trashData.map(t => ({
        id: `trash-${t.name}`,
        name: t.name,
        type: 'application/octet-stream',
        category: 'trash',
        size: t.size,
        url: t.publicUrl,
        path: t.path,
        deletedAt: t.deletedAt
      })));
      setLoadingDocs(false);
    }
  };

  // Simplified folder loading without database dependency
  const loadPersistentFolders = async () => {
    if (!user) return;
    
    try {
      // For now, just group by categories until database is set up
      const folderGroups: {[key: string]: Document[]} = {};
      
      documents.forEach(doc => {
        const folderName = `${doc.category.charAt(0).toUpperCase() + doc.category.slice(1)} Documents`;
        if (!folderGroups[folderName]) {
          folderGroups[folderName] = [];
        }
        folderGroups[folderName].push(doc);
      });
      
      setSmartFolders(folderGroups);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  // Filter documents based on search and category
  const filteredDocuments = useMemo(() => {
    const currentList = selectedCategory === "trash" ? trashDocs : documents;
    return currentList.filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all"
          ? doc.category !== "trash" // exclude trash from All view
          : doc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [trashDocs, documents, searchQuery, selectedCategory]);

  // Document counts for sidebar (include trash)
  const documentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: documents.length };
    [...documents, ...trashDocs].forEach((doc) => {
      if (doc.category === "trash") {
        counts.trash = (counts.trash || 0) + 1;
      } else {
        counts[doc.category] = (counts[doc.category] || 0) + 1;
      }
      return counts;
    });
    return counts;
  }, [documents, trashDocs]);

  const handleUpload = async (file: File, name: string, category: string, isPrivate: boolean = false) => {
    if (!user) {
      toast({ title: "Not authenticated", description: "Please log in first", variant: "destructive" });
      return;
    }
    try {
      // Upload to Supabase Storage
            const { publicUrl, path } = await uploadDocument(user.id, file, name, category, isPrivate);

      const newDocument: Document = {
        id: Date.now().toString(),
        name,
        type: file.name.split(".").pop() || "unknown",
        category,
        uploadDate: new Date(),
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        url: publicUrl,
        path,
      };

      setDocuments((prev) => [newDocument, ...prev]);
    } catch (error) {
      console.error(error);
      toast({
        title: "Upload Failed",
        description: (error as Error).message || "Upload failed",
        variant: "destructive",
      });
    }
  };


  const requireAuth = async (document: Document | TrashDocument): Promise<boolean> => {
    if (document.category !== 'private') return true;
    
    if (!isSupported) {
      toast({ title: 'Authentication required', description: 'Please use a device with biometric support', variant: 'destructive' });
      return false;
    }
    
    try {
      let authenticated = await authenticateUser();
      if (!authenticated) {
        // maybe no credential yet – try to register then authenticate again
        await registerCredential().catch(()=>{});
        authenticated = await authenticateUser();
      }
      if (!authenticated) {
        toast({ title: 'Authentication failed', description: 'Biometric verification required for private documents', variant: 'destructive' });
      }
      return authenticated;
    } catch (error) {
      toast({ title: 'Authentication error', description: 'Failed to verify identity', variant: 'destructive' });
      return false;
    }
  };

  const handleView = async (document: Document | TrashDocument) => {
    if (!(await requireAuth(document))) return;
    if (document.url) {
      window.open(document.url, "_blank");
      return;
    }
    if (document.file) {
      const url = URL.createObjectURL(document.file);
      window.open(url, '_blank');
    } else {
      toast({
        title: "View Document",
        description: `Opening ${document.name}...`,
      });
    }
  };

  const handleDownload = async (document: Document | TrashDocument) => {
    if (!(await requireAuth(document))) return;
    
    try {
      const { data, error } = await supabase.storage.from('documents').download(document.path);
      if (error) throw error;
      const blob = data as Blob;
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast({ title: 'Download failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handlePrint = async (document: Document | TrashDocument) => {
    if (!(await requireAuth(document))) return;
    if (document.url) {
      const printWindow = window.open(document.url, "_blank");
      printWindow?.addEventListener("load", () => {
        printWindow.print();
      });
      return;
    }
    if (document.file) {
      const url = URL.createObjectURL(document.file);
      const printWindow = window.open(url, '_blank');
      printWindow?.addEventListener('load', () => {
        printWindow.print();
      });
    } else {
      toast({
        title: "Print Document",
        description: `Preparing ${document.name} for printing...`,
      });
    }
  };

  // Handle document rename
  const handleRename = async (document: Document, newName: string) => {
    if (!user) return;

    try {
      // Update document in Supabase storage
      const oldPath = `${user.id}/${document.name}`;
      const newPath = `${user.id}/${newName}`;

      // Copy file to new location
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(oldPath);

      if (downloadError) throw downloadError;

      // Upload with new name
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(newPath, fileData, { upsert: true });

      if (uploadError) throw uploadError;

      // Delete old file
      const { error: deleteError } = await supabase.storage
        .from('documents')
        .remove([oldPath]);

      if (deleteError) console.warn('Warning: Could not delete old file:', deleteError);

      // Update document in state
      setDocuments(prevDocs => 
        prevDocs.map(doc => 
          doc.id === document.id 
            ? { ...doc, name: newName, path: newPath }
            : doc
        )
      );

      // Update smart folder assignments if needed
      if (smartFoldersMode) {
        const { error: updateError } = await supabase
          .from('smart_folder_assignments')
          .update({ document_path: newPath })
          .eq('user_id', user.id)
          .eq('document_path', oldPath);

        if (updateError) console.warn('Warning: Could not update folder assignments:', updateError);

        // Update smart folders state
        setSmartFolders(prevFolders => {
          const updatedFolders = { ...prevFolders };
          Object.keys(updatedFolders).forEach(folderName => {
            updatedFolders[folderName] = updatedFolders[folderName].map(doc =>
              doc.id === document.id ? { ...doc, name: newName, path: newPath } : doc
            );
          });
          return updatedFolders;
        });
      }

      toast({
        title: "Document Renamed",
        description: `Successfully renamed to "${newName}"`,
      });
    } catch (error) {
      console.error('Error renaming document:', error);
      toast({
        title: "Error",
        description: "Failed to rename document. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Handle document sharing
  const handleShare = async (document: Document, shareSettings: ShareSettings): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    
    // Prevent sharing of private documents
    if (document.category === 'private') {
      throw new Error('Cannot share private documents');
    }

    try {
      // Generate unique share token
      const shareToken = crypto.randomUUID();
      
      // Calculate expiration date
      const expiresAt = shareSettings.expiresIn > 0 
        ? new Date(Date.now() + shareSettings.expiresIn * 60 * 60 * 1000)
        : null;

      // Hash password if provided
      let passwordHash = null;
      if (shareSettings.requiresPassword && shareSettings.password) {
        // Simple hash for demo - in production, use proper hashing
        passwordHash = btoa(shareSettings.password);
      }

      // Save share record to database
      const { error } = await supabase
        .from('document_shares')
        .insert({
          user_id: user.id,
          document_path: document.path || `${user.id}/${document.name}`,
          share_token: shareToken,
          is_public: shareSettings.isPublic,
          expires_at: expiresAt,
          password_hash: passwordHash,
          allow_download: shareSettings.allowDownload
        });

      if (error) throw error;

      // Generate share URL
      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/shared/${shareToken}`;

      toast({
        title: "Share Link Generated",
        description: "Document share link has been created successfully.",
      });

      return shareUrl;
    } catch (error) {
      console.error('Error creating share link:', error);
      toast({
        title: "Error",
        description: "Failed to create share link. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;

    // locate document in either list
    const doc = documents.find((d) => d.id === id);
    const trashDoc = trashDocs.find((d) => d.id === id);
    const foundDoc = doc || trashDoc;
    if (!foundDoc) return;

    // Private docs: immediate permanent delete
    if (foundDoc.category === 'private') {
      if (!window.confirm(`Permanently delete "${foundDoc.name}"? This action cannot be undone.`)) {
        return;
      }
      try {
        await deletePermanent(`${user.id}/${id}`);
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        toast({ title: 'Private document deleted permanently', description: doc.name });
      } catch (e) {
        console.error(e);
        toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
      }
      return;
    }

    if (selectedCategory === 'trash') {
      if (!window.confirm(`Permanently delete "${foundDoc.name}"? This action cannot be undone.`)) {
        return;
      }
      const trashDoc = trashDocs.find((d) => d.id === id);
      if (!trashDoc) return;
      try {
        console.log('Attempting to delete:', trashDoc.id);
        await deletePermanent(`${user.id}/${trashDoc.id}`);
        
        // Refresh trash list from backend to ensure sync
        await loadDocuments(); // This will reload both documents and trash
        
        toast({ title: 'Deleted permanently', description: trashDoc.name });
      } catch (e) {
        console.error('Delete error:', e);
        toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
      }
    } else {
      const doc = documents.find((d) => d.id === id);
      if (!doc) return;
      try {
        console.log('Attempting to delete document:', {
          id: doc.id,
          name: doc.name,
          path: doc.path,
          userId: user.id
        });
        console.log('About to call moveToTrash with:', { userId: user.id, path: doc.path });
        await moveToTrash(user.id, doc.path!);
        console.log('moveToTrash completed successfully');
        
        // Reload documents from backend to ensure sync
        console.log('Reloading documents after deletion...');
        await loadDocuments();
        console.log('Documents reloaded');
        
        // Only update UI state after successful backend operations
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        
        toast({ title: 'Document deleted permanently', description: doc.name });
      } catch (e) {
        console.error(e);
        toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
      }
    }
  };

  const handleRestore = async (id: string) => {
    if (!user) return;
    const doc = trashDocs.find((d) => d.id === id);
    if (!doc) return;
    try {
      // Use the document ID for restoration
      await restoreFromTrash(user.id, doc.id);
      setTrashDocs(prev => prev.filter(d => d.id !== id));
      await loadDocuments();
      toast({ title: 'Restored', description: doc.name });
    } catch (e) {
      console.error(e);
      toast({ title: 'Restore failed', description: (e as Error).message, variant: 'destructive' });
    }
  };
  const handleBulkCategoryUpdate = async (updates: Array<{ path: string; category: string }>) => {
    try {
      for (const update of updates) {
        const doc = documents.find(d => d.path === update.path);
        if (doc) {
          doc.category = update.category;
        }
      }
      setDocuments([...documents]);
      toast({
        title: "Categories Updated",
        description: `Updated ${updates.length} document${updates.length !== 1 ? 's' : ''}`,
      });
    } finally {
      setBulkCategorizeOpen(false);
    }
  };

  const onUpload = async (file: File, name: string, category: string, isPrivate: boolean) => {
    try {
      const result = await uploadDocument(user.id, file, name, category, isPrivate);
      
      // Auto-assign to folder if we have persistent folders
      if (persistentFolders.length > 0) {
        try {
          const { autoAssignDocumentToFolder } = await import('../lib/supabaseClient');
          const assignment = await autoAssignDocumentToFolder(user.id, result.path, name, category, file.type);
          if (assignment) {
            toast({
              title: assignment.action === 'assigned' ? 'Document uploaded and sorted' : 'Document uploaded and new folder created',
              description: `Added to "${assignment.folderName}" folder`,
            });
            // Reload folders to show the new assignment
            await loadPersistentFolders();
          }
        } catch (error) {
          console.warn('Auto-assignment failed:', error);
        }
      }
      
      await loadDocuments();
      toast({ title: 'Upload successful', description: name });
      return result;
    } catch (e) {
      console.error(e);
      toast({ title: 'Upload failed', description: (e as Error).message, variant: 'destructive' });
      throw e;
    }
  };

  const handleSmartFolders = async () => {
    if (smartFoldersMode) {
      setSmartFoldersMode(false);
      return;
    }

    if (!user) return;
    
    // If we have persistent folders, just load them
    if (persistentFolders.length > 0) {
      await loadPersistentFolders();
      setSmartFoldersMode(true);
      return;
    }

    // First time - create folders using AI analysis
    setIsAnalyzingFolders(true);
    try {
      const folders: {[key: string]: Document[]} = {};
      const createdFolders: any[] = [];
      
      // Analyze documents with Gemini AI to group them intelligently
      for (const doc of documents) {
        try {
          const analysis = await analyzeDocumentForGrouping(doc);
          const folderName = analysis.folder || 'Other Documents';
          
          if (!folders[folderName]) {
            folders[folderName] = [];
            // Create persistent folder
            try {
              const newFolder = await createSmartFolder(user.id, folderName, `Auto-created folder for ${folderName.toLowerCase()}`);
              createdFolders.push(newFolder);
            } catch (error) {
              console.warn('Error creating folder:', folderName, error);
            }
          }
          folders[folderName].push(doc);
          
          // Assign document to folder
          const folder = createdFolders.find(f => f.folder_name === folderName);
          if (folder) {
            try {
              await assignDocumentToFolder(`${user.id}/${doc.name}`, folder.id);
            } catch (error) {
              console.warn('Error assigning document to folder:', error);
            }
          }
        } catch (error) {
          console.error('Error analyzing document:', doc.name, error);
          // Fallback to category-based grouping
          const fallbackFolder = `${doc.category.charAt(0).toUpperCase() + doc.category.slice(1)} Documents`;
          if (!folders[fallbackFolder]) {
            folders[fallbackFolder] = [];
            try {
              const newFolder = await createSmartFolder(user.id, fallbackFolder, `Auto-created folder for ${doc.category} documents`);
              createdFolders.push(newFolder);
            } catch (error) {
              console.warn('Error creating fallback folder:', error);
            }
          }
          folders[fallbackFolder].push(doc);
          
          const folder = createdFolders.find(f => f.folder_name === fallbackFolder);
          if (folder) {
            try {
              await assignDocumentToFolder(`${user.id}/${doc.name}`, folder.id);
            } catch (error) {
              console.warn('Error assigning document to fallback folder:', error);
            }
          }
        }
      }
      
      setPersistentFolders(createdFolders);
      setSmartFolders(folders);
      setSmartFoldersMode(true);
      
      toast({
        title: "Smart Folders Created",
        description: `Created ${Object.keys(folders).length} persistent smart folders. They will sync across all your devices.`,
      });
    } finally {
      setIsAnalyzingFolders(false);
    }
  };

  const toggleFolder = (folderName: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderName)) {
      newExpanded.delete(folderName);
    } else {
      newExpanded.add(folderName);
    }
    setExpandedFolders(newExpanded);
  };

  const startRenaming = (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolder(folderName);
    setEditingName(folderName);
  };

  const cancelRenaming = () => {
    setEditingFolder(null);
    setEditingName('');
  };

  const saveRename = () => {
    if (!editingFolder || !editingName.trim()) return;
    
    const trimmedName = editingName.trim();
    
    // Check for name conflicts
    if (trimmedName !== editingFolder && smartFolders[trimmedName]) {
      toast({
        title: "Name already exists",
        description: "A folder with this name already exists. Please choose a different name.",
        variant: "destructive"
      });
      return;
    }
    
    // Update folder name in smartFolders
    const updatedFolders = { ...smartFolders };
    const folderDocs = updatedFolders[editingFolder];
    delete updatedFolders[editingFolder];
    updatedFolders[trimmedName] = folderDocs;
    
    // Update expanded folders if this folder was expanded
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(editingFolder)) {
      newExpanded.delete(editingFolder);
      newExpanded.add(trimmedName);
      setExpandedFolders(newExpanded);
    }
    
    setSmartFolders(updatedFolders);
    setEditingFolder(null);
    setEditingName('');
    
    toast({
      title: "Folder renamed",
      description: `Folder renamed to "${trimmedName}"`
    });
  };

  const handleRenameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveRename();
    } else if (e.key === 'Escape') {
      cancelRenaming();
    }
  };

  // Load existing smart folders from database
  const loadSmartFoldersFromDB = async () => {
    if (!user) return { folders: [], assignments: [], smartFoldersData: {} };

    try {
      // Load smart folders
      const { data: folders, error: foldersError } = await supabase
        .from('smart_folders')
        .select('*')
        .eq('user_id', user.id);

      if (foldersError) throw foldersError;

      // Load folder assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('smart_folder_assignments')
        .select('*')
        .eq('user_id', user.id);

      if (assignmentsError) throw assignmentsError;

      // Build smart folders structure
      const smartFoldersData: {[key: string]: Document[]} = {};
      
      folders?.forEach(folder => {
        smartFoldersData[folder.folder_name] = [];
      });

      // Assign documents to folders
      assignments?.forEach(assignment => {
        const folder = folders?.find(f => f.id === assignment.folder_id);
        const document = documents.find(d => d.path === assignment.document_path);
        
        if (folder && document) {
          if (!smartFoldersData[folder.folder_name]) {
            smartFoldersData[folder.folder_name] = [];
          }
          smartFoldersData[folder.folder_name].push(document);
        }
      });

      return { folders: folders || [], assignments: assignments || [], smartFoldersData };
    } catch (error) {
      console.error('Error loading smart folders:', error);
      return { folders: [], assignments: [], smartFoldersData: {} };
    }
  };

  // Save smart folder to database
  const saveSmartFolderToDB = async (folderName: string, keywords: string[], description?: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('smart_folders')
        .insert({
          user_id: user.id,
          folder_name: folderName,
          folder_description: description,
          keywords: keywords
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving smart folder:', error);
      return null;
    }
  };

  // Assign document to folder in database
  const assignDocumentToFolder = async (documentPath: string, folderId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('smart_folder_assignments')
        .upsert({
          user_id: user.id,
          document_path: documentPath,
          folder_id: folderId
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error assigning document to folder:', error);
      return false;
    }
  };

  // Generate keywords for a folder based on documents
  const generateFolderKeywords = (folderName: string, documents: Document[]): string[] => {
    const keywords = new Set<string>();
    
    // Add folder name words
    folderName.toLowerCase().split(' ').forEach(word => {
      if (word.length > 2) keywords.add(word);
    });

    // Add common words from document names
    documents.forEach(doc => {
      const words = doc.name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(' ')
        .filter(word => word.length > 2);
      
      words.forEach(word => keywords.add(word));
    });

    return Array.from(keywords).slice(0, 10); // Limit to 10 keywords
  };

  // Enhanced smart folder creation with persistence
  const handleSmartFoldersWithoutDB = async () => {
    if (smartFoldersMode) {
      setSmartFoldersMode(false);
      return;
    }

    if (!user) return;
    
    setIsAnalyzingFolders(true);
    try {
      // First, load existing smart folders from database
      const { folders: existingFolders, smartFoldersData } = await loadSmartFoldersFromDB();
      
      if (existingFolders.length > 0) {
        // We have existing folders, only process new documents
        const existingAssignments = new Set();
        const { data: assignments } = await supabase
          .from('smart_folder_assignments')
          .select('document_path')
          .eq('user_id', user.id);
        
        assignments?.forEach(a => existingAssignments.add(a.document_path));
        
        const newDocuments = documents.filter(doc => !existingAssignments.has(doc.path));
        
        if (newDocuments.length > 0) {
          // Process new documents
          for (const doc of newDocuments) {
            try {
              // Try to find matching existing folder
              const existingFolderData = existingFolders.map(f => ({
                name: f.folder_name,
                keywords: f.keywords || [],
                description: f.folder_description
              }));

              const match = await findBestMatchingFolder(doc.name, doc.category, existingFolderData);
              
              if (match) {
                // Assign to existing folder
                const folder = existingFolders.find(f => f.folder_name === match.folderName);
                if (folder) {
                  await assignDocumentToFolder(doc.path, folder.id);
                  if (!smartFoldersData[folder.folder_name]) {
                    smartFoldersData[folder.folder_name] = [];
                  }
                  smartFoldersData[folder.folder_name].push(doc);
                }
              } else {
                // Create new folder for this document
                const subcategory = await getSubcategoryName(doc.name, doc.category);
                const keywords = generateFolderKeywords(subcategory, [doc]);
                
                const newFolder = await saveSmartFolderToDB(subcategory, keywords);
                if (newFolder) {
                  await assignDocumentToFolder(doc.path, newFolder.id);
                  if (!smartFoldersData[subcategory]) {
                    smartFoldersData[subcategory] = [];
                  }
                  smartFoldersData[subcategory].push(doc);
                }
              }
              
              // Add delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
              console.error(`Error processing ${doc.name}:`, error);
            }
          }
        }
        
        setSmartFolders(smartFoldersData);
        setSmartFoldersMode(true);
        
        toast({
          title: "Smart Folders Loaded",
          description: `Loaded existing smart folders and processed ${newDocuments.length} new documents.`,
        });
      } else {
        // No existing folders, create from scratch
        const folders: {[key: string]: Document[]} = {};
        const folderPromises: Promise<any>[] = [];
        
        // Group documents by AI subcategory
        for (const doc of documents) {
          try {
            const subcategory = await getSubcategoryName(doc.name, doc.category);
            
            if (!folders[subcategory]) {
              folders[subcategory] = [];
            }
            folders[subcategory].push(doc);
            
            await new Promise(resolve => setTimeout(resolve, 150));
          } catch (error) {
            console.error(`Error subcategorizing ${doc.name}:`, error);
            
            const fallbackName = `${doc.category.charAt(0).toUpperCase() + doc.category.slice(1)} Documents`;
            if (!folders[fallbackName]) {
              folders[fallbackName] = [];
            }
            folders[fallbackName].push(doc);
          }
        }
        
        // Save folders to database
        for (const [folderName, folderDocs] of Object.entries(folders)) {
          const keywords = generateFolderKeywords(folderName, folderDocs);
          const savedFolder = await saveSmartFolderToDB(folderName, keywords);
          
          if (savedFolder) {
            // Assign all documents to this folder
            for (const doc of folderDocs) {
              await assignDocumentToFolder(doc.path, savedFolder.id);
            }
          }
        }
        
        setSmartFolders(folders);
        setSmartFoldersMode(true);
        
        toast({
          title: "Smart Folders Created",
          description: `Created ${Object.keys(folders).length} persistent AI-powered smart folders.`,
        });
      }
    } finally {
      setIsAnalyzingFolders(false);
    }
  };

  const analyzeDocumentForGrouping = async (document: Document): Promise<{folder: string, reasoning: string}> => {
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      console.warn('Gemini API key not found, using fallback grouping');
      // Fallback to category-based grouping
      const categoryFolder = `${document.category.charAt(0).toUpperCase() + document.category.slice(1)} Documents`;
      return {
        folder: categoryFolder,
        reasoning: 'Fallback grouping based on document category'
      };
    }

    const prompt = `
Analyze this document and suggest a smart folder name based on its source, purpose, or context.

Document Information:
- Name: ${document.name}
- Category: ${document.category}
- Type: ${document.type}

Examples of good folder names:
- "College Documents" (for semester results, certificates from educational institutions)
- "Bank Documents" (for statements, loan papers from banks)
- "Medical Records" (for reports, prescriptions from hospitals/clinics)
- "Government Documents" (for official certificates, licenses)
- "Work Documents" (for employment letters, salary slips)
- "Personal Certificates" (for personal achievements, courses)

Respond with a JSON object:
{
  "folder": "suggested_folder_name",
  "reasoning": "brief_explanation_why_this_folder"
}

Focus on grouping documents that likely come from the same source or serve similar purposes.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('No response from Gemini AI');
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          folder: result.folder || 'Other Documents',
          reasoning: result.reasoning || 'No specific reasoning provided'
        };
      }

      throw new Error('Invalid response format from Gemini AI');
    } catch (apiError) {
      console.warn('Gemini API call failed, using fallback:', apiError);
      // Fallback to category-based grouping
      const categoryFolder = `${document.category.charAt(0).toUpperCase() + document.category.slice(1)} Documents`;
      return {
        folder: categoryFolder,
        reasoning: 'Fallback grouping due to API error'
      };
    }
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/50">
      <Header
        onUpload={() => setUploadDialogOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />
      
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6 relative">
          {/* Mobile Overlay */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={`
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0 md:static fixed left-0 top-0 h-full w-72 z-[60] transition-transform duration-300 ease-in-out
            md:flex-shrink-0 pt-16 md:pt-0
          `}>
            <div className="bg-white/80 backdrop-blur-md h-full md:bg-transparent p-4 md:p-0">
              <CategoryFilter
                selectedCategory={selectedCategory}
                onCategoryChange={async (category) => {
                  await handleCategoryChange(category);
                  setIsMobileMenuOpen(false);
                }}
                documentCounts={documentCounts}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {smartFoldersMode ? "Smart Folders" : 
                   selectedCategory === "all" ? "All Documents" : 
                   selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
                </h2>
                <p className="text-muted-foreground">
                  {smartFoldersMode ? 
                    `${Object.keys(smartFolders).length} smart folder${Object.keys(smartFolders).length !== 1 ? 's' : ''} created` :
                    `${filteredDocuments.length} document${filteredDocuments.length !== 1 ? 's' : ''} found`
                  }
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Smart Categorization Button */}
                {documents.length > 0 && selectedCategory !== "trash" && (
                  <Button
                    variant="outline"
                    onClick={() => setBulkCategorizeOpen(true)}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 rounded-xl px-4 py-2"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    <span className="font-medium">Smart Categorize</span>
                  </Button>
                )}
                
                {/* Mobile View Toggle */}
                <div className="md:hidden flex bg-white rounded-xl p-1 shadow-md">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSmartFoldersMode(false)}
                    className={`rounded-lg transition-all px-3 py-2 text-xs ${!smartFoldersMode ? "bg-blue-500 text-white shadow-md" : "hover:bg-gray-100"}`}
                  >
                    All Docs
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSmartFoldersWithoutDB()}
                    className={`rounded-lg transition-all px-3 py-2 text-xs ${smartFoldersMode ? "bg-blue-500 text-white shadow-md" : "hover:bg-gray-100"}`}
                    disabled={isAnalyzingFolders}
                  >
                    {isAnalyzingFolders ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      "Smart Folders"
                    )}
                  </Button>
                </div>
                
                {/* Desktop Grid/List Toggle */}
                <div className="hidden md:flex bg-white rounded-xl p-1 shadow-md">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMode("grid")}
                    className={`rounded-lg transition-all ${viewMode === "grid" ? "bg-blue-500 text-white shadow-md" : "hover:bg-gray-100"}`}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMode("list")}
                    className={`rounded-lg transition-all ${viewMode === "list" ? "bg-blue-500 text-white shadow-md" : "hover:bg-gray-100"}`}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Smart Folders or Documents Grid */}
            {smartFoldersMode ? (
              // Smart Folders View - Modern Professional UI
              <div className="space-y-6">
                {Object.keys(smartFolders).length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-32 h-32 bg-gradient-to-br from-purple-100 to-purple-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <Folder className="w-16 h-16 text-purple-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">No Smart Folders</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      Click "Smart Folders" to analyze and organize your documents automatically.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Folders Grid */}
                    <div className="grid gap-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {Object.entries(smartFolders).map(([folderName, folderDocs]) => {
                        const isExpanded = expandedFolders.has(folderName);
                        return (
                          <div key={folderName} className="group">
                            {/* Modern Folder Design */}
                            <div 
                              onClick={() => toggleFolder(folderName)}
                              className="cursor-pointer transform transition-all duration-300 hover:scale-105 active:scale-95"
                            >
                              <div className="relative">
                                {/* 3D Folder Effect */}
                                <div className="w-20 h-16 mx-auto mb-3 relative perspective-1000">
                                  {/* Folder Back */}
                                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg transform rotate-y-12 shadow-xl opacity-60"></div>
                                  
                                  {/* Main Folder */}
                                  <div className={`absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg shadow-2xl transition-all duration-500 transform ${
                                    isExpanded ? 'rotate-y-6 scale-105' : 'rotate-y-3'
                                  } group-hover:rotate-y-6 group-hover:shadow-3xl`}>
                                    {/* Folder Tab */}
                                    <div className="absolute -top-2 left-2 w-8 h-4 bg-gradient-to-br from-blue-400 to-blue-600 rounded-t-md shadow-md"></div>
                                    
                                    {/* Folder Content Area */}
                                    <div className="absolute inset-2 bg-blue-100/20 rounded backdrop-blur-sm">
                                      <div className="flex items-center justify-center h-full">
                                        <div className={`transition-all duration-500 transform ${
                                          isExpanded ? 'rotate-12 scale-110' : 'rotate-0'
                                        }`}>
                                          {isExpanded ? (
                                            <FolderOpen className="w-6 h-6 text-white drop-shadow-lg" />
                                          ) : (
                                            <Folder className="w-6 h-6 text-white drop-shadow-lg" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Glossy Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-lg"></div>
                                  </div>
                                  
                                  {/* Document Count Badge */}
                                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg ring-2 ring-white transform transition-all duration-300 group-hover:scale-110">
                                    {folderDocs.length}
                                  </div>
                                </div>
                                
                                {/* Folder Name */}
                                <div className="text-center px-2">
                                  {editingFolder === folderName ? (
                                    <div className="space-y-2">
                                      <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onKeyDown={handleRenameKeyPress}
                                        className="w-full text-sm font-semibold text-center bg-white border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex justify-center space-x-1">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); saveRename(); }}
                                          className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); cancelRenaming(); }}
                                          className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative group/name">
                                      <p className={`text-sm font-semibold transition-all duration-300 truncate ${
                                        isExpanded ? 'text-blue-600 scale-105' : 'text-gray-700'
                                      } group-hover:text-blue-600`}>
                                        {folderName.replace(' Documents', '')}
                                      </p>
                                      <button
                                        onClick={(e) => startRenaming(folderName, e)}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-gray-600 text-white rounded-full flex items-center justify-center opacity-0 group/name-hover:opacity-100 hover:bg-gray-700 transition-all duration-200 transform hover:scale-110"
                                        title="Rename folder"
                                      >
                                        <Edit3 className="w-2.5 h-2.5" />
                                      </button>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {folderDocs.length} item{folderDocs.length !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Expanded Folder Content */}
                    {Array.from(expandedFolders).map(folderName => {
                      const folderDocs = smartFolders[folderName] || [];
                      return (
                        <div 
                          key={`expanded-${folderName}`}
                          className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-slideDown"
                          style={{
                            animation: 'slideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                          }}
                        >
                          {/* Folder Header */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                                  <FolderOpen className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                  {editingFolder === folderName ? (
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onKeyDown={handleRenameKeyPress}
                                        className="flex-1 text-lg font-bold bg-white border border-blue-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button
                                        onClick={(e) => { e.stopPropagation(); saveRename(); }}
                                        className="w-8 h-8 bg-green-500 text-white rounded-lg flex items-center justify-center hover:bg-green-600 transition-colors"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); cancelRenaming(); }}
                                        className="w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="group/header-name relative">
                                      <div className="flex items-center space-x-2">
                                        <h3 className="text-lg font-bold text-gray-900">{folderName}</h3>
                                        <button
                                          onClick={(e) => startRenaming(folderName, e)}
                                          className="w-6 h-6 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center opacity-0 group-hover/header-name:opacity-100 hover:bg-gray-200 transition-all duration-200"
                                          title="Rename folder"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <p className="text-sm text-gray-600">{folderDocs.length} document{folderDocs.length !== 1 ? 's' : ''}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button 
                                onClick={() => toggleFolder(folderName)}
                                className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          
                          {/* Documents Grid */}
                          <div className="p-6">
                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {folderDocs.map((document, index) => (
                                <div 
                                  key={document.id} 
                                  className="animate-fadeInUp"
                                  style={{ 
                                    animationDelay: `${index * 0.1}s`,
                                    animation: `fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.1}s both`
                                  }}
                                >
                                  <DocumentCard
                                    document={document}
                                    onView={handleView}
                                    onDownload={handleDownload}
                                    onPrint={handlePrint}
                                    onDelete={handleDelete}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              // Regular Documents View
              filteredDocuments.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Filter className="w-16 h-16 text-blue-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">No documents found</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    {searchQuery 
                      ? "Try adjusting your search terms or category filter."
                      : "Upload your first document to get started with smart organization."
                    }
                  </p>
                  <Button 
                    onClick={() => setUploadDialogOpen(true)}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 rounded-xl px-8 py-3 font-medium"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Upload Document
                  </Button>
                </div>
              ) : selectedCategory === 'trash' ? (
                <div className={`grid gap-6 animate-fade-in ${
                  viewMode === "grid" 
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3" 
                    : "grid-cols-1 max-w-4xl mx-auto"
                }`}>
                  {trashDocs.map((document, index) => (
                    <div key={document.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                      <TrashDocumentCard
                        document={document}
                        onView={handleView}
                        onDownload={handleDownload}
                        onPrint={handlePrint}
                        onRestore={handleRestore}
                        onDeletePermanent={(id) => handleDelete(id)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`grid gap-6 animate-fade-in ${
                  viewMode === "grid" 
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3" 
                    : "grid-cols-1 max-w-4xl mx-auto"
                }`}>
                  {selectedCategory === "trash" ? (
                    filteredDocuments.map((document, index) => (
                      <div key={document.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                        <TrashDocumentCard
                          document={document as TrashDocument}
                          onView={handleView}
                          onDownload={handleDownload}
                          onPrint={handlePrint}
                          onRestore={handleRestore}
                          onDeletePermanent={handleDelete}
                        />
                      </div>
                    ))
                  ) : (
                    filteredDocuments.map((document, index) => (
                      <div key={document.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                        <DocumentCard
                          document={document as Document}
                          onView={handleView}
                          onDownload={handleDownload}
                          onPrint={handlePrint}
                          onDelete={handleDelete}
                          onRename={(doc) => setRenameDialog({ isOpen: true, document: doc })}
                          onShare={(doc) => setShareDialog({ isOpen: true, document: doc })}
                        />
                      </div>
                    ))
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUpload={onUpload}
      />
      
      <BulkCategorizeDialog
        open={bulkCategorizeOpen}
        onOpenChange={setBulkCategorizeOpen}
        documents={documents.map(doc => ({
          name: doc.name,
          path: doc.path || '',
          category: doc.category,
          publicUrl: doc.url || '',
          size: parseInt(doc.size.replace(' MB', '')) * 1024 * 1024
        }))}
        onUpdateCategories={handleBulkCategoryUpdate}
      />

      {/* Rename Dialog */}
      <RenameDialog
        isOpen={renameDialog.isOpen}
        onClose={() => setRenameDialog({ isOpen: false, document: null })}
        document={renameDialog.document}
        onRename={handleRename}
      />

      {/* Share Dialog */}
      <ShareDialog
        isOpen={shareDialog.isOpen}
        onClose={() => setShareDialog({ isOpen: false, document: null })}
        document={shareDialog.document}
        onShare={handleShare}
      />
    </div>
  );
};

export default Index;
