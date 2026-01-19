import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Question {
  question_text: string;
  question_type: "multiple_choice" | "true_false" | "short_answer";
  options?: string[];
  correct_answer: string;
  solution?: string;
  explanation?: string;
  order_index: number;
  image_url?: string;
  context?: string;
  given_info?: string;
  required_info?: string;
  image_analysis?: string;
}

interface ImageQuestionData {
  question_index: number;
  image_base64: string;
  page_number: number;
}

// Simple PDF text extraction from base64
async function extractTextFromPdf(base64Pdf: string): Promise<string> {
  try {
    const binaryString = atob(base64Pdf);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pdfContent = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const textParts: string[] = [];
    
    const btEtPattern = /BT\s*([\s\S]*?)\s*ET/g;
    let btMatch;
    while ((btMatch = btEtPattern.exec(pdfContent)) !== null) {
      const block = btMatch[1];
      const tjPattern = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjPattern.exec(block)) !== null) {
        if (tjMatch[1].trim()) {
          textParts.push(tjMatch[1]);
        }
      }
      const tjArrayPattern = /\[([^\]]+)\]\s*TJ/g;
      let tjArrMatch;
      while ((tjArrMatch = tjArrayPattern.exec(block)) !== null) {
        const arr = tjArrMatch[1];
        const strings = arr.match(/\(([^)]*)\)/g);
        if (strings) {
          strings.forEach(s => {
            const text = s.slice(1, -1).trim();
            if (text) textParts.push(text);
          });
        }
      }
    }
    
    if (textParts.length < 5) {
      const readablePattern = /[\x20-\x7E\n\r\t]{20,}/g;
      let readableMatch;
      while ((readableMatch = readablePattern.exec(pdfContent)) !== null) {
        const text = readableMatch[0].trim();
        if (!text.includes('/Type') && !text.includes('/Font') && 
            !text.includes('stream') && !text.includes('endstream') &&
            !text.match(/^\d+ \d+ obj/) && !text.includes('xref')) {
          textParts.push(text);
        }
      }
    }
    
    const extractedText = textParts.join(' ').replace(/\s+/g, ' ').trim();
    console.log(`Extracted ${extractedText.length} characters from PDF`);
    
    return extractedText || "Unable to extract text from PDF. The PDF may be image-based.";
  } catch (error) {
    console.error("PDF extraction error:", error);
    return "Error extracting PDF content";
  }
}

// Upload image to Supabase Storage and return URL
async function uploadImageToStorage(
  supabase: any,
  imageBase64: string,
  examId: string,
  questionIndex: number
): Promise<string | null> {
  try {
    const fileName = `exam-images/${examId}/question-${questionIndex}-${Date.now()}.jpg`;
    
    // Convert base64 to Uint8Array
    const binaryString = atob(imageBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const { data, error } = await supabase.storage
      .from('question-images')
      .upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (error) {
      console.error("Failed to upload image:", error);
      return null;
    }
    
    const { data: urlData } = supabase.storage
      .from('question-images')
      .getPublicUrl(fileName);
    
    return urlData?.publicUrl || null;
  } catch (error) {
    console.error("Image upload error:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { 
      questionsPdf, 
      solutionsPdf, 
      hasSeparateSolutions, 
      questionsText: questionsTextFromClient, 
      solutionsText: solutionsTextFromClient,
      useOcr,
      questionsImages,
      solutionsImages,
      examId
    } = await req.json();

    if (!questionsPdf && !questionsTextFromClient && (!questionsImages || questionsImages.length === 0)) {
      return new Response(JSON.stringify({ error: "Questions PDF, text, or images are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Parsing PDF exam with enhanced image support...", {
      hasSeparateSolutions,
      useOcr,
      hasQuestionsImages: questionsImages?.length > 0,
      hasSolutionsImages: solutionsImages?.length > 0,
      examId: examId || 'new',
    });

    let questions: Question[] = [];

    if (useOcr && questionsImages && questionsImages.length > 0) {
      // Enhanced OCR mode with image-based question analysis
      console.log(`Processing ${questionsImages.length} question pages with enhanced vision AI`);
      
      // Build image content for the AI
      const imageContent: any[] = [];
      
      // Add all question page images with page number tracking
      for (let i = 0; i < questionsImages.length; i++) {
        imageContent.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${questionsImages[i]}` }
        });
      }
      
      // Add solutions page images if provided
      if (hasSeparateSolutions && solutionsImages && solutionsImages.length > 0) {
        console.log(`Processing ${solutionsImages.length} solution pages with vision AI`);
        for (let i = 0; i < solutionsImages.length; i++) {
          imageContent.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${solutionsImages[i]}` }
          });
        }
      }

      const enhancedOcrSystemPrompt = `You are an expert OCR, diagram analysis, and exam parser specialized in engineering, physics, and technical exams. You will receive images of exam pages that may contain:
- Question text
- Multiple choice options
- Diagrams, figures, circuits, graphs, equations
- Mathematical symbols and formulas
- Technical drawings with labels and annotations

Your task is to:

1. **READ AND TRANSCRIBE** all text accurately (OCR)

2. **DETECT AND ANALYZE IMAGES/DIAGRAMS** for each question:
   - Identify diagrams, figures, circuit diagrams, graphs, force diagrams, etc.
   - Analyze arrows, labels, symbols, and their relationships
   - Understand equations and mathematical expressions
   - Note which page and area contains the relevant image

3. **DECOMPOSE EACH QUESTION** into structured parts:
   - **context**: Background information or scenario description
   - **given_info**: Explicitly stated values, conditions, or given data
   - **required_info**: What the question is asking to find or calculate

4. **EXTRACT ANSWER CHOICES** exactly as they appear in the PDF:
   - Do NOT invent or modify any answer options
   - Keep the exact wording from the original PDF
   - If no options are present, mark as short_answer type

5. **IDENTIFY CORRECT ANSWER** only from the given choices:
   - Use the image analysis + question context to determine the correct answer
   - Match logically based on calculations or reasoning
   - The correct_answer MUST be one of the options if it's multiple choice
   - If you cannot determine the answer with confidence, leave correct_answer empty

6. **GENERATE EXPLANATION**:
   - Provide step-by-step reasoning
   - Reference the diagram/image analysis when relevant
   - Show calculations if applicable

CRITICAL: Return ONLY a valid JSON array with NO additional text, markdown, or formatting.
Each question object must have these fields:
{
  "question_text": "The full question text",
  "question_type": "multiple_choice" | "true_false" | "short_answer",
  "options": ["Option A text", "Option B text", ...],
  "correct_answer": "The exact text of the correct option",
  "solution": "Original solution if visible",
  "explanation": "Step-by-step explanation with diagram analysis",
  "context": "Background/scenario of the question",
  "given_info": "Given values and conditions",
  "required_info": "What needs to be found",
  "image_analysis": "Description of relevant diagram/figure and what it shows",
  "has_image": true | false,
  "image_page": 1 (page number where the relevant image is, 1-indexed)
}

Example output:
[{
  "question_text": "A circuit contains a 10Ω resistor and a 5V battery. Calculate the current.",
  "question_type": "multiple_choice",
  "options": ["0.5 A", "1.0 A", "2.0 A", "5.0 A"],
  "correct_answer": "0.5 A",
  "solution": "",
  "explanation": "Using Ohm's law I = V/R = 5V/10Ω = 0.5A. The diagram shows a simple series circuit with a battery and resistor connected.",
  "context": "A simple DC circuit analysis problem",
  "given_info": "Resistance R = 10Ω, Voltage V = 5V",
  "required_info": "Calculate the current flowing through the circuit",
  "image_analysis": "Circuit diagram showing a 5V battery connected in series with a 10Ω resistor. Current direction is indicated by an arrow.",
  "has_image": true,
  "image_page": 1
}]`;

      let ocrUserPrompt = `Analyze these exam page images and extract ALL questions with their diagrams and images. `;
      if (hasSeparateSolutions && solutionsImages && solutionsImages.length > 0) {
        ocrUserPrompt += `The first ${questionsImages.length} images are question pages, and the remaining ${solutionsImages.length} images are solution pages. Match solutions to questions. `;
      }
      ocrUserPrompt += `
For each question:
1. Extract the exact question text and all answer options as they appear
2. Analyze any diagrams, figures, or images associated with the question
3. Decompose into context/given/required
4. Determine the correct answer ONLY from the given options
5. Generate a detailed explanation

Return ONLY the JSON array.`;

      console.log("Sending images to AI for enhanced vision parsing...");

      // Use a more capable model for complex image analysis
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro", // Use Pro for better vision understanding
          messages: [
            { role: "system", content: enhancedOcrSystemPrompt },
            { 
              role: "user", 
              content: [
                { type: "text", text: ocrUserPrompt },
                ...imageContent
              ]
            }
          ],
          temperature: 0.2, // Lower temperature for more accurate extraction
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI API error: ${response.status}`);
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content || "";

      console.log("Enhanced vision AI response received, length:", content.length);
      console.log("AI response preview:", content.substring(0, 800));

      const parsedQuestions = parseQuestionsFromAIResponse(content);

      // Process questions with images - upload to storage and attach URLs
      for (let i = 0; i < parsedQuestions.length; i++) {
        const q = parsedQuestions[i] as any;
        
        // If question has an associated image, upload the page image
        if (q.has_image && q.image_page && questionsImages[q.image_page - 1]) {
          const imageIndex = q.image_page - 1;
          const tempExamId = examId || `temp-${user.id}-${Date.now()}`;
          
          const imageUrl = await uploadImageToStorage(
            supabaseClient,
            questionsImages[imageIndex],
            tempExamId,
            i
          );
          
          if (imageUrl) {
            parsedQuestions[i].image_url = imageUrl;
            console.log(`Uploaded image for question ${i + 1}: ${imageUrl}`);
          }
        }
        
        // Clean up temporary fields
        delete (parsedQuestions[i] as any).has_image;
        delete (parsedQuestions[i] as any).image_page;
      }

      questions = parsedQuestions;

    } else {
      // Text-based parsing (original flow with enhancements)
      const questionsText = questionsTextFromClient
        ? String(questionsTextFromClient)
        : await extractTextFromPdf(questionsPdf);

      console.log(`Questions text length: ${questionsText.length}`);
      console.log("Questions text preview:", questionsText.substring(0, 500));

      let solutionsText = "";
      if (hasSeparateSolutions) {
        if (solutionsTextFromClient) {
          solutionsText = String(solutionsTextFromClient);
        } else if (solutionsPdf) {
          solutionsText = await extractTextFromPdf(solutionsPdf);
        }

        if (solutionsText) {
          console.log(`Solutions text length: ${solutionsText.length}`);
          console.log("Solutions text preview:", solutionsText.substring(0, 500));
        }
      }

      const systemPrompt = `You are an expert exam parser for engineering and physics exams. Your task is to:

1. **EXTRACT QUESTIONS** exactly as they appear in the text

2. **DECOMPOSE EACH QUESTION** into:
   - **context**: Background information or scenario
   - **given_info**: Given values, conditions, or data
   - **required_info**: What needs to be found or answered

3. **EXTRACT ANSWER OPTIONS** exactly as written:
   - Do NOT invent or modify any options
   - Keep exact wording from the original

4. **IDENTIFY CORRECT ANSWER** only from the given choices:
   - Match from solutions if provided
   - Must be one of the options for multiple choice

5. **GENERATE EXPLANATION**:
   - Step-by-step reasoning
   - Reference formulas and concepts

CRITICAL: Return ONLY a valid JSON array. Each question must have:
{
  "question_text": "Full question",
  "question_type": "multiple_choice" | "true_false" | "short_answer",
  "options": ["Option A", "Option B", ...],
  "correct_answer": "Exact option text",
  "solution": "Original solution if available",
  "explanation": "Step-by-step explanation",
  "context": "Background/scenario",
  "given_info": "Given values",
  "required_info": "What to find"
}`;

      let userPrompt = "";
      if (hasSeparateSolutions && solutionsText) {
        userPrompt = `Here is the exam questions text:

${questionsText}

And here are the solutions:

${solutionsText}

Extract all questions, decompose them, match with solutions, and generate explanations. Return ONLY the JSON array.`;
      } else {
        userPrompt = `Here is the exam text (may include both questions and solutions):

${questionsText}

Extract all questions, decompose each into context/given/required, and generate explanations. Return ONLY the JSON array.`;
      }

      console.log("Sending to AI for parsing...");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI API error: ${response.status}`);
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content || "";

      console.log("AI response received, length:", content.length);
      console.log("AI response preview:", content.substring(0, 500));

      questions = parseQuestionsFromAIResponse(content);

      if (questions.length === 0 && (questionsText.length < 50 || questionsText.includes("Unable to extract"))) {
        throw new Error("Could not extract text from PDF. The PDF may be image-based or scanned. Please enable OCR mode and try again.");
      }
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("No questions found in the PDF. Please ensure the PDF contains exam questions.");
    }

    // Add order_index and ensure all fields exist
    questions = questions.map((q, i) => ({
      question_text: q.question_text || "",
      question_type: q.question_type || "short_answer",
      options: q.options || [],
      correct_answer: q.correct_answer || "",
      solution: q.solution || "",
      explanation: q.explanation || "",
      order_index: i,
      image_url: q.image_url || undefined,
      context: q.context || undefined,
      given_info: q.given_info || undefined,
      required_info: q.required_info || undefined,
      image_analysis: q.image_analysis || undefined,
    }));

    console.log(`Successfully parsed ${questions.length} questions with enhanced structure`);

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper function to parse questions from AI response
function parseQuestionsFromAIResponse(content: string): Question[] {
  let questions: Question[] = [];
  
  try {
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```json")) {
      cleanContent = cleanContent.slice(7);
    } else if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.slice(3);
    }
    if (cleanContent.endsWith("```")) {
      cleanContent = cleanContent.slice(0, -3);
    }
    cleanContent = cleanContent.trim();

    const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      questions = JSON.parse(jsonMatch[0]);
    } else {
      questions = JSON.parse(cleanContent);
    }
  } catch (parseError) {
    console.error("Failed to parse AI response:", parseError);
    console.log("Raw content:", content.substring(0, 2000));
    throw new Error("Failed to parse questions from the PDF content. Please try again.");
  }
  
  return questions;
}