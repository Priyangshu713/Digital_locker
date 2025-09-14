-- Smart Folders Database Setup
-- Run these SQL commands in your Supabase SQL Editor

-- Create smart_folders table
CREATE TABLE IF NOT EXISTS smart_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  folder_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_folders table for assignments
CREATE TABLE IF NOT EXISTS document_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_path TEXT NOT NULL,
  folder_id UUID NOT NULL REFERENCES smart_folders(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, document_path)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_smart_folders_user_id ON smart_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_user_id ON document_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_folder_id ON document_folders(folder_id);

-- Enable Row Level Security
ALTER TABLE smart_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own folders" ON smart_folders
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own document assignments" ON document_folders
  FOR ALL USING (auth.uid() = user_id);

-- Create deleted_documents table to track deleted files
CREATE TABLE IF NOT EXISTS deleted_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_path TEXT NOT NULL,
  document_name TEXT NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, document_path)
);

-- Create index and RLS for deleted_documents
CREATE INDEX IF NOT EXISTS idx_deleted_documents_user_id ON deleted_documents(user_id);
ALTER TABLE deleted_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own deleted documents" ON deleted_documents
  FOR ALL USING (auth.uid() = user_id);

-- Create smart_folders table to store persistent smart folders
CREATE TABLE IF NOT EXISTS smart_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  folder_name TEXT NOT NULL,
  folder_description TEXT,
  keywords TEXT[], -- Array of keywords for matching
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, folder_name)
);

-- Create smart_folder_assignments table to track document-folder relationships
CREATE TABLE IF NOT EXISTS smart_folder_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_path TEXT NOT NULL,
  folder_id UUID NOT NULL REFERENCES smart_folders(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, document_path)
);

-- Create indexes and RLS for smart_folders
CREATE INDEX IF NOT EXISTS idx_smart_folders_user_id ON smart_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_folder_assignments_user_id ON smart_folder_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_folder_assignments_folder_id ON smart_folder_assignments(folder_id);

ALTER TABLE smart_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_folder_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own smart folders" ON smart_folders
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own folder assignments" ON smart_folder_assignments
  FOR ALL USING (auth.uid() = user_id);

-- Create document_shares table for sharing functionality
CREATE TABLE IF NOT EXISTS document_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_path TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  is_public BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  password_hash TEXT,
  allow_download BOOLEAN DEFAULT true,
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes and RLS for document_shares
CREATE INDEX IF NOT EXISTS idx_document_shares_user_id ON document_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_token ON document_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_document_shares_expires_at ON document_shares(expires_at);

ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own document shares" ON document_shares
  FOR ALL USING (auth.uid() = user_id);

-- Allow public access to shared documents (for viewing)
CREATE POLICY "Public can view non-expired shares" ON document_shares
  FOR SELECT USING (
    is_public = true AND 
    (expires_at IS NULL OR expires_at > NOW())
  );

-- Allow anonymous access to shared documents
CREATE POLICY "Anonymous can view public shares" ON document_shares
  FOR SELECT TO anon USING (
    is_public = true AND 
    (expires_at IS NULL OR expires_at > NOW())
  );
