// Using fetch API to call Gemini AI directly since the package import is having issues
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface CategorySuggestion {
  category: string;
  confidence: number;
  reasoning: string;
  subcategory?: string;
}

// Enhanced category mapping with subcategories
export const categoryMapping = {
  education: {
    label: "Education",
    subcategories: [
      "academic_transcripts",
      "certificates",
      "degree_documents",
      "semester_results",
      "course_completion",
      "internship_documents",
      "scholarship_documents"
    ]
  },
  identity: {
    label: "Identity",
    subcategories: [
      "passport",
      "drivers_license",
      "national_id",
      "voter_id",
      "birth_certificate",
      "address_proof"
    ]
  },
  financial: {
    label: "Financial",
    subcategories: [
      "bank_statements",
      "tax_documents",
      "investment_documents",
      "insurance_policies",
      "loan_documents",
      "salary_slips"
    ]
  },
  medical: {
    label: "Medical",
    subcategories: [
      "medical_reports",
      "prescriptions",
      "vaccination_certificates",
      "health_insurance",
      "medical_bills"
    ]
  },
  legal: {
    label: "Legal",
    subcategories: [
      "contracts",
      "legal_notices",
      "court_documents",
      "property_documents",
      "wills_trusts"
    ]
  },
  other: {
    label: "Other",
    subcategories: [
      "personal_documents",
      "travel_documents",
      "employment_documents",
      "miscellaneous"
    ]
  }
};

export async function categorizeDocument(
  fileName: string,
  fileContent?: string
): Promise<CategorySuggestion> {
  try {
    if (!GEMINI_API_KEY) {
      console.warn("Gemini API key not found, using fallback categorization");
      return fallbackCategorization(fileName);
    }

    const prompt = `
You are an intelligent document categorization system for a digital locker application. 
Analyze the following document information and categorize it into one of these main categories:

Categories:
1. education - Academic documents, certificates, transcripts, semester results, course materials, internship documents
2. identity - ID documents, passports, licenses, birth certificates, address proofs
3. financial - Bank statements, tax documents, investment papers, insurance, loan documents, salary slips
4. medical - Medical reports, prescriptions, vaccination certificates, health insurance, medical bills
5. legal - Contracts, legal notices, court documents, property papers, wills
6. other - Any document that doesn't fit the above categories

Document Information:
- File Name: ${fileName}
${fileContent ? `- Content Preview: ${fileContent.substring(0, 500)}` : ''}

Please respond with a JSON object containing:
{
  "category": "main_category_name",
  "confidence": confidence_score_0_to_1,
  "reasoning": "brief_explanation_of_categorization",
  "subcategory": "specific_subcategory_if_applicable"
}

Focus on accuracy and provide a confidence score based on how certain you are about the categorization.
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
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
      throw new Error("No response from Gemini AI");
    }

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const suggestion = JSON.parse(jsonMatch[0]);
      
      // Validate the category exists
      if (!categoryMapping[suggestion.category as keyof typeof categoryMapping]) {
        suggestion.category = "other";
        suggestion.confidence = Math.max(0.3, suggestion.confidence - 0.2);
        suggestion.reasoning += " (Fallback to 'other' category)";
      }

      return suggestion;
    }

    throw new Error("Invalid response format from Gemini AI");
  } catch (error) {
    console.error("Error categorizing document:", error);
    
    // Fallback categorization based on filename patterns
    return fallbackCategorization(fileName);
  }
}

function fallbackCategorization(fileName: string): CategorySuggestion {
  const lowerFileName = fileName.toLowerCase();
  
  // Education patterns
  if (lowerFileName.includes('semester') || 
      lowerFileName.includes('transcript') || 
      lowerFileName.includes('certificate') ||
      lowerFileName.includes('degree') ||
      lowerFileName.includes('result') ||
      lowerFileName.includes('marksheet')) {
    return {
      category: "education",
      confidence: 0.7,
      reasoning: "Filename contains education-related keywords",
      subcategory: "academic_transcripts"
    };
  }

  // Identity patterns
  if (lowerFileName.includes('passport') || 
      lowerFileName.includes('license') || 
      lowerFileName.includes('id') ||
      lowerFileName.includes('aadhar') ||
      lowerFileName.includes('pan')) {
    return {
      category: "identity",
      confidence: 0.7,
      reasoning: "Filename contains identity document keywords"
    };
  }

  // Financial patterns
  if (lowerFileName.includes('bank') || 
      lowerFileName.includes('statement') || 
      lowerFileName.includes('tax') ||
      lowerFileName.includes('salary') ||
      lowerFileName.includes('invoice')) {
    return {
      category: "financial",
      confidence: 0.7,
      reasoning: "Filename contains financial document keywords"
    };
  }

  // Medical patterns
  if (lowerFileName.includes('medical') || 
      lowerFileName.includes('prescription') || 
      lowerFileName.includes('report') ||
      lowerFileName.includes('health')) {
    return {
      category: "medical",
      confidence: 0.7,
      reasoning: "Filename contains medical document keywords"
    };
  }

  // Legal patterns
  if (lowerFileName.includes('contract') || 
      lowerFileName.includes('agreement') || 
      lowerFileName.includes('legal') ||
      lowerFileName.includes('court')) {
    return {
      category: "legal",
      confidence: 0.7,
      reasoning: "Filename contains legal document keywords"
    };
  }

  return {
    category: "other",
    confidence: 0.5,
    reasoning: "Could not determine category from filename, defaulting to 'other'"
  };
}

export async function getSubcategoryName(
  fileName: string,
  category: string,
  fileContent?: string
): Promise<string> {
  try {
    if (!GEMINI_API_KEY) {
      console.warn("Gemini API key not found, using fallback subcategorization");
      return getFallbackSubcategory(fileName, category);
    }

    const prompt = `
You are an intelligent document subcategorization system. Given a document in the "${category}" category, 
determine the most appropriate subcategory or umbrella term for better organization.

Document Information:
- File Name: ${fileName}
- Main Category: ${category}
${fileContent ? `- Content Preview: ${fileContent.substring(0, 500)}` : ''}

Based on the document type, suggest a specific subcategory name that would be useful for grouping similar documents.

Examples for Education category:
- Course certificates → "Courses"
- Academic transcripts → "Transcripts" 
- Degree documents → "Degrees"
- Semester results → "Results"
- Internship documents → "Internships"

Examples for Financial category:
- Bank statements → "Bank Statements"
- Tax documents → "Tax Documents"
- Investment papers → "Investments"
- Insurance policies → "Insurance"
- Salary slips → "Salary"

Examples for Identity category:
- Passport documents → "Passport"
- Driver's licenses → "Licenses"
- National ID cards → "National ID"
- Address proofs → "Address Proof"

Examples for Medical category:
- Medical reports → "Medical Reports"
- Prescriptions → "Prescriptions"
- Vaccination certificates → "Vaccinations"
- Health insurance → "Health Insurance"

Examples for Legal category:
- Contracts → "Contracts"
- Property documents → "Property"
- Court documents → "Court Documents"

Respond with ONLY the subcategory name (2-3 words max, title case). Do not include quotes or explanations.
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
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
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      throw new Error("No response from Gemini AI");
    }

    // Clean up the response and ensure it's a valid subcategory name
    const subcategory = text.replace(/['"]/g, '').trim();
    
    // Validate length and format
    if (subcategory.length > 0 && subcategory.length <= 30) {
      return subcategory;
    }

    throw new Error("Invalid subcategory format");
  } catch (error) {
    console.error("Error getting subcategory:", error);
    return getFallbackSubcategory(fileName, category);
  }
}

function getFallbackSubcategory(fileName: string, category: string): string {
  const lowerFileName = fileName.toLowerCase();
  
  switch (category) {
    case 'education':
      if (lowerFileName.includes('certificate') || lowerFileName.includes('course')) return 'Courses';
      if (lowerFileName.includes('transcript')) return 'Transcripts';
      if (lowerFileName.includes('degree')) return 'Degrees';
      if (lowerFileName.includes('result') || lowerFileName.includes('semester')) return 'Results';
      if (lowerFileName.includes('internship')) return 'Internships';
      return 'Academic Documents';
      
    case 'financial':
      if (lowerFileName.includes('bank') || lowerFileName.includes('statement')) return 'Bank Statements';
      if (lowerFileName.includes('tax')) return 'Tax Documents';
      if (lowerFileName.includes('salary')) return 'Salary';
      if (lowerFileName.includes('investment')) return 'Investments';
      if (lowerFileName.includes('insurance')) return 'Insurance';
      return 'Financial Documents';
      
    case 'identity':
      if (lowerFileName.includes('passport')) return 'Passport';
      if (lowerFileName.includes('license')) return 'Licenses';
      if (lowerFileName.includes('aadhar') || lowerFileName.includes('national')) return 'National ID';
      if (lowerFileName.includes('address')) return 'Address Proof';
      return 'Identity Documents';
      
    case 'medical':
      if (lowerFileName.includes('prescription')) return 'Prescriptions';
      if (lowerFileName.includes('report')) return 'Medical Reports';
      if (lowerFileName.includes('vaccination')) return 'Vaccinations';
      if (lowerFileName.includes('insurance')) return 'Health Insurance';
      return 'Medical Documents';
      
    case 'legal':
      if (lowerFileName.includes('contract')) return 'Contracts';
      if (lowerFileName.includes('property')) return 'Property';
      if (lowerFileName.includes('court')) return 'Court Documents';
      return 'Legal Documents';
      
    default:
      return 'Miscellaneous';
  }
}

export async function findBestMatchingFolder(
  fileName: string,
  category: string,
  existingFolders: Array<{ name: string; keywords: string[]; description?: string }>
): Promise<{ folderName: string; confidence: number } | null> {
  try {
    if (!GEMINI_API_KEY) {
      console.warn("Gemini API key not found, using fallback folder matching");
      return findFallbackMatchingFolder(fileName, category, existingFolders);
    }

    const prompt = `
You are an intelligent document folder matching system. Given a document and a list of existing folders, determine which folder (if any) is the best match for this document.

Document Information:
- File Name: ${fileName}
- Category: ${category}

Existing Folders:
${existingFolders.map((folder, index) => 
  `${index + 1}. "${folder.name}" - Keywords: [${folder.keywords.join(', ')}]${folder.description ? ` - Description: ${folder.description}` : ''}`
).join('\n')}

Analyze the document and determine:
1. Which existing folder (if any) is the best match
2. How confident you are in this match (0.0 to 1.0)

If the confidence is below 0.7, consider it as no match and the document should get its own new folder.

Respond with a JSON object:
{
  "folderName": "exact_folder_name_from_list_or_null",
  "confidence": confidence_score_0_to_1,
  "reasoning": "brief_explanation"
}

If no folder is a good match, respond with:
{
  "folderName": null,
  "confidence": 0.0,
  "reasoning": "No suitable existing folder found"
}
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
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
      throw new Error("No response from Gemini AI");
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      if (result.folderName && result.confidence >= 0.7) {
        return {
          folderName: result.folderName,
          confidence: result.confidence
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error finding matching folder:", error);
    return findFallbackMatchingFolder(fileName, category, existingFolders);
  }
}

function findFallbackMatchingFolder(
  fileName: string,
  category: string,
  existingFolders: Array<{ name: string; keywords: string[] }>
): { folderName: string; confidence: number } | null {
  const lowerFileName = fileName.toLowerCase();
  
  for (const folder of existingFolders) {
    const matchingKeywords = folder.keywords.filter(keyword => 
      lowerFileName.includes(keyword.toLowerCase())
    );
    
    if (matchingKeywords.length > 0) {
      const confidence = Math.min(0.8, matchingKeywords.length / folder.keywords.length + 0.3);
      return {
        folderName: folder.name,
        confidence
      };
    }
  }
  
  return null;
}

export async function bulkCategorizeDocuments(
  documents: Array<{ name: string; path: string; category: string }>,
  onProgress?: (processed: number, total: number, currentDoc: string) => void
): Promise<Array<{ path: string; suggestedCategory: string; confidence: number; reasoning: string }>> {
  const results = [];
  const BATCH_SIZE = 3; // Process 3 documents at a time for better rate limit control
  const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches
  const DELAY_BETWEEN_DOCS = 500; // 500ms delay between individual documents
  const MAX_RETRIES = 2; // Fewer retries since lite model is more reliable
  
  // Process documents in small batches
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    
    // Process each document in the batch sequentially
    for (const doc of batch) {
      let retries = 0;
      let success = false;
      
      while (retries < MAX_RETRIES && !success) {
        try {
          onProgress?.(results.length, documents.length, doc.name);
          
          const suggestion = await categorizeDocumentWithRetry(doc.name, retries);
          results.push({
            path: doc.path,
            suggestedCategory: suggestion.category,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning
          });
          success = true;
          
          // Short delay between individual documents
          if (results.length < documents.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DOCS));
          }
        } catch (error) {
          retries++;
          console.error(`Error categorizing ${doc.name} (attempt ${retries}):`, error);
          
          if (retries < MAX_RETRIES) {
            // Longer backoff to handle rate limits better
            const backoffDelay = 1000 * Math.pow(2, retries);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          } else {
            // Final fallback after all retries failed
            results.push({
              path: doc.path,
              suggestedCategory: "other",
              confidence: 0.3,
              reasoning: "Error occurred during categorization after multiple attempts"
            });
            success = true; // Mark as success to continue processing
          }
        }
      }
    }
    
    // Delay between batches
    if (i + BATCH_SIZE < documents.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  return results;
}

async function categorizeDocumentWithRetry(
  fileName: string,
  retryCount: number = 0
): Promise<CategorySuggestion> {
  try {
    if (!GEMINI_API_KEY) {
      console.warn("Gemini API key not found, using fallback categorization");
      return fallbackCategorization(fileName);
    }

    const prompt = `
You are an intelligent document categorization system for a digital locker application. 
Analyze the following document information and categorize it into one of these main categories:

Categories:
1. education - Academic documents, certificates, transcripts, semester results, course materials, internship documents
2. identity - ID documents, passports, licenses, birth certificates, address proofs
3. financial - Bank statements, tax documents, investment papers, insurance, loan documents, salary slips
4. medical - Medical reports, prescriptions, vaccination certificates, health insurance, medical bills
5. legal - Contracts, legal notices, court documents, property papers, wills
6. other - Any document that doesn't fit the above categories

Document Information:
- File Name: ${fileName}

Please respond with a JSON object containing:
{
  "category": "main_category_name",
  "confidence": confidence_score_0_to_1,
  "reasoning": "brief_explanation_of_categorization",
  "subcategory": "specific_subcategory_if_applicable"
}

Focus on accuracy and provide a confidence score based on how certain you are about the categorization.
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
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
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded (attempt ${retryCount + 1})`);
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("No response from Gemini AI");
    }

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const suggestion = JSON.parse(jsonMatch[0]);
      
      // Validate the category exists
      if (!categoryMapping[suggestion.category as keyof typeof categoryMapping]) {
        suggestion.category = "other";
        suggestion.confidence = Math.max(0.3, suggestion.confidence - 0.2);
        suggestion.reasoning += " (Fallback to 'other' category)";
      }

      return suggestion;
    }

    throw new Error("Invalid response format from Gemini AI");
  } catch (error) {
    console.error("Error categorizing document:", error);
    
    // For rate limit errors, throw to trigger retry
    if (error.message.includes('Rate limit') || error.message.includes('429')) {
      throw error;
    }
    
    // For other errors, fallback immediately
    return fallbackCategorization(fileName);
  }
}
