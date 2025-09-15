import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client using environment variables.
// Make sure to add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env (browser-safe keys)
// Example:
//   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
//   VITE_SUPABASE_ANON_KEY=public-anon-key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0cXNhZHpuaHRldGl3bnN4amZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc0MDg0MywiZXhwIjoyMDczMzE2ODQzfQ.AL-tkuqWvW2FZMqOtGRlWE00zBHeIreeSsC8ZmXOK5I';

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn("Supabase environment variables are missing.\nPlease define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload a document to the `documents` storage bucket and return its public URL.
 * The file will be stored under a timestamp-based path to avoid collisions.
 */
export async function uploadDocument(userId: string, file: File, name: string, category: string, isPrivate: boolean = false): Promise<{ publicUrl: string; path: string }> {
  const fileExt = file.name.split(".").pop();
  // Encode name and category in filename: timestamp_category_name.ext
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
  const prefix = isPrivate ? `${userId}/private` : userId;
  const filePath = `${prefix}/${Date.now()}_${category}_${safeName}.${fileExt}`;

  const { error } = await supabase.storage.from("documents").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("documents").getPublicUrl(filePath);

    return { publicUrl: data.publicUrl, path: filePath };
}

// Fetch user's documents
// Move a file to trash folder
export async function moveToTrash(userId: string, path: string) {
  const filename = path.split("/").pop();
  const dest = `${userId}/trash/${filename}`;
  
  // Copy to trash
  const { error: copyErr } = await supabase.storage.from("documents").copy(path, dest);
  if (copyErr) throw copyErr;
  
  // Remove from original location
  const { error: delErr } = await supabase.storage.from("documents").remove([path]);
  if (delErr) throw delErr;
  
  // Clean up database references
  await cleanupDocumentReferences(userId, path);
  
  // Track in deleted_documents table
  const { error: trackErr } = await supabase
    .from('deleted_documents')
    .upsert({
      user_id: userId,
      document_path: path,
      document_name: filename || 'unknown'
    });
  
  if (trackErr) {
    console.warn('Failed to track deleted document:', trackErr);
  }
}

export async function restoreFromTrash(userId: string, filename: string) {
  const src = `${userId}/trash/${filename}`;
  const dest = `${userId}/${Date.now()}_${filename}`;
  
  // Copy from trash back to main location
  const { error: copyErr } = await supabase.storage.from("documents").copy(src, dest);
  if (copyErr) throw copyErr;
  
  // Remove from trash
  await supabase.storage.from("documents").remove([src]);
  
  // Remove from deleted_documents tracking since it's restored
  const { error: trackErr } = await supabase
    .from('deleted_documents')
    .delete()
    .eq('user_id', userId)
    .eq('document_path', src);
  
  if (trackErr) {
    console.warn('Failed to remove from deleted documents tracking:', trackErr);
  }
  
  const { data } = supabase.storage.from("documents").getPublicUrl(dest);
  return { path: dest, publicUrl: data.publicUrl };
}

export async function listUserTrash(userId: string) {
  const { data, error } = await supabase.storage.from("documents").list(`${userId}/trash`, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw error;
  return (
    data?.map((obj) => {
      const { data: pub } = supabase.storage.from("documents").getPublicUrl(`${userId}/trash/${obj.name}`);
      return { name: obj.name, path: `${userId}/trash/${obj.name}`, publicUrl: pub.publicUrl, size: obj.metadata?.size || 0, deletedAt: obj.created_at };
    }) || []
  );
}

export async function deletePermanent(path: string) {
  // Remove from storage
  await supabase.storage.from("documents").remove([path]);
  
  // Clean up database references
  const userId = path.split('/')[0];
  await cleanupDocumentReferences(userId, path);
}

// Helper function to clean up database references when a document is deleted
async function cleanupDocumentReferences(userId: string, documentPath: string) {
  try {
    // Remove from smart folder assignments
    const { error: assignmentErr } = await supabase
      .from('smart_folder_assignments')
      .delete()
      .eq('user_id', userId)
      .eq('document_path', documentPath);
    
    if (assignmentErr) {
      console.warn('Failed to clean up folder assignments:', assignmentErr);
    }
    
    // Remove from document shares
    const { error: shareErr } = await supabase
      .from('document_shares')
      .delete()
      .eq('user_id', userId)
      .eq('document_path', documentPath);
    
    if (shareErr) {
      console.warn('Failed to clean up document shares:', shareErr);
    }
    
    // Remove from deleted_documents tracking
    const { error: deletedErr } = await supabase
      .from('deleted_documents')
      .delete()
      .eq('user_id', userId)
      .eq('document_path', documentPath);
    
    if (deletedErr) {
      console.warn('Failed to clean up deleted documents tracking:', deletedErr);
    }
  } catch (error) {
    console.error('Error cleaning up document references:', error);
  }
}

export async function purgeOldTrash(userId: string, days = 30) {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  const trash = await listUserTrash(userId);
  const toDelete = trash.filter((t) => t.size > 0 && new Date(t.deletedAt).getTime() < threshold).map((t) => t.path);
  if (toDelete.length) {
    await supabase.storage.from("documents").remove(toDelete);
  }
}

export async function listUserDocuments(userId: string): Promise<Array<{ name: string; path: string; publicUrl: string; size: number; category: string; created_at: string }>> {
  try {
    // List regular documents
    const { data: regularData, error: regularError } = await supabase.storage
      .from("documents")
      .list(userId, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
    
    if (regularError) {
      console.error('Error listing regular documents:', regularError);
      throw regularError;
    }

    // List private documents
    const { data: privateData, error: privateError } = await supabase.storage
      .from("documents")
      .list(`${userId}/private`, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
    
    if (privateError) {
      console.error('Error listing private documents:', privateError);
      // Don't throw, as we might still have regular documents
    }

    // Process regular documents
    const regularDocs = (regularData || [])
      .filter(obj => obj.name && obj.name.includes('.') && (obj.metadata?.size || 0) > 0)
      .map(obj => {
        const fullPath = `${userId}/${obj.name}`;
        const { data: pub } = supabase.storage.from("documents").getPublicUrl(fullPath);
        const { category, displayName } = parseFilename(obj.name);
        
        return {
          name: displayName,
          path: fullPath,
          publicUrl: pub.publicUrl,
          size: obj.metadata?.size || 0,
          category: category,
          created_at: obj.created_at,
        };
      });

    // Process private documents
    const privateDocs = (privateData || [])
      .filter(obj => obj.name && obj.name.includes('.') && (obj.metadata?.size || 0) > 0)
      .map(obj => {
        const fullPath = `${userId}/private/${obj.name}`;
        const { data: pub } = supabase.storage.from("documents").getPublicUrl(fullPath);
        const { category, displayName } = parseFilename(obj.name);
        
        return {
          name: displayName,
          path: fullPath,
          publicUrl: pub.publicUrl,
          size: obj.metadata?.size || 0,
          category: 'private', // Always set category to private for these
          created_at: obj.created_at,
        };
      });

    // Combine and return all documents
    return [...regularDocs, ...privateDocs];
  } catch (error) {
    console.error('Error in listUserDocuments:', error);
    throw error;
  }
}

// Helper function to parse filenames and extract category and display name
function parseFilename(filename: string): { category: string; displayName: string } {
  const parts = filename.split('_');
  let category = 'other';
  let displayName = filename;
  
  if (parts.length >= 3) {
    category = parts[1];
    const nameWithExt = parts.slice(2).join('_');
    displayName = nameWithExt.replace(/\.\w+$/, '').replace(/_/g, ' ');
  }
  
  return { category, displayName };
}

export async function createSmartFolder(userId: string, folderName: string, description: string) {
  const { data, error } = await supabase
    .from('smart_folders')
    .insert([{ user_id: userId, folder_name: folderName, folder_description: description }])
    .select();
  if (error) throw error;
  return data[0];
}

export async function getUserSmartFolders(userId: string) {
  const { data, error } = await supabase
    .from('smart_folders')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data;
}

export async function getDocumentFolderAssignments(userId: string) {
  const { data, error } = await supabase
    .from('smart_folder_assignments')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data;
}

export async function assignDocumentToFolder(documentPath: string, folderId: string) {
    const { data, error } = await supabase
        .from('smart_folder_assignments')
        .insert([{ document_path: documentPath, folder_id: folderId }]);
    if (error) throw error;
    return data;
}

export async function autoAssignDocumentToFolder(userId: string, documentPath: string, documentName: string, documentCategory: string, documentType: string) {
    // This is a complex function that requires AI. For now, I will just return null.
    return null;
}