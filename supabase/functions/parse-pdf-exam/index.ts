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
}

// Simple PDF text extraction from base64
async function extractTextFromPdf(base64Pdf: string): Promise<string> {
  try {
    // Decode base64 to binary
    const binaryString = atob(base64Pdf);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert to string and extract readable text
    const pdfContent = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    
    // Extract text from PDF streams and objects
    const textParts: string[] = [];
    
    // Method 1: Extract from text streams (BT...ET blocks)
    const btEtPattern = /BT\s*([\s\S]*?)\s*ET/g;
    let btMatch;
    while ((btMatch = btEtPattern.exec(pdfContent)) !== null) {
      const block = btMatch[1];
      // Extract text from Tj and TJ operators
      const tjPattern = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjPattern.exec(block)) !== null) {
        if (tjMatch[1].trim()) {
          textParts.push(tjMatch[1]);
        }
      }
      // Extract from TJ arrays
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
    
    // Method 2: Extract readable strings (fallback)
    if (textParts.length < 5) {
      // Find sequences of printable characters
      const readablePattern = /[\x20-\x7E\n\r\t]{20,}/g;
      let readableMatch;
      while ((readableMatch = readablePattern.exec(pdfContent)) !== null) {
        const text = readableMatch[0].trim();
        // Filter out PDF syntax
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

    const { questionsPdf, solutionsPdf, hasSeparateSolutions } = await req.json();

    if (!questionsPdf) {
      return new Response(JSON.stringify({ error: "Questions PDF is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Parsing PDF exam...", hasSeparateSolutions ? "with separate solutions" : "single PDF");

    // Extract text from PDFs
    const questionsText = await extractTextFromPdf(questionsPdf);
    console.log("Questions text preview:", questionsText.substring(0, 500));
    
    let solutionsText = "";
    if (hasSeparateSolutions && solutionsPdf) {
      solutionsText = await extractTextFromPdf(solutionsPdf);
      console.log("Solutions text preview:", solutionsText.substring(0, 500));
    }

    // Build the prompt for text-based parsing
    const systemPrompt = `You are an expert exam parser and educational content creator. Your task is to:
1. Extract all questions from the provided text exactly as they appear
2. Identify the question type (multiple_choice, true_false, or short_answer)
3. Extract all answer options for multiple choice questions
4. Identify the correct answer from the solutions provided
5. Extract the solution/working if provided
6. Generate a clear, educational explanation for each question that helps students understand:
   - Why the correct answer is right
   - Why other options are wrong (for multiple choice)
   - The key concepts being tested
   - Any helpful tips or mnemonics

CRITICAL: Return ONLY a valid JSON array with NO additional text, markdown, or formatting.
Each question object must have:
- question_text: string (the full question)
- question_type: "multiple_choice" | "true_false" | "short_answer"
- options: string[] (for multiple choice, without A/B/C/D prefixes)
- correct_answer: string (the correct answer text, not the letter)
- solution: string (the original solution from PDF if available, or empty string)
- explanation: string (your AI-generated educational explanation)

Example output format:
[{"question_text":"What is 2+2?","question_type":"multiple_choice","options":["3","4","5","6"],"correct_answer":"4","solution":"","explanation":"2+2=4 because..."}]`;

    let userPrompt = "";
    if (hasSeparateSolutions && solutionsText) {
      userPrompt = `Here is the exam questions text:

${questionsText}

And here are the solutions:

${solutionsText}

Please extract all questions, match them with their solutions, and generate helpful explanations. Return ONLY the JSON array.`;
    } else {
      userPrompt = `Here is the exam text (may include both questions and solutions):

${questionsText}

Please extract all questions and their solutions (if included), and generate helpful educational explanations for each. Return ONLY the JSON array.`;
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
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    console.log("AI response received, length:", content.length);
    console.log("AI response preview:", content.substring(0, 500));

    // Parse the JSON from the response
    let questions: Question[] = [];
    try {
      // Clean up the response - remove markdown code blocks if present
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

      // Try to find JSON array in the response
      const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing the whole content as JSON
        questions = JSON.parse(cleanContent);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content.substring(0, 2000));
      
      // If no questions could be parsed, return a helpful error
      if (questionsText.length < 50 || questionsText.includes("Unable to extract")) {
        throw new Error("Could not extract text from PDF. The PDF may be image-based or protected. Please try a different PDF or manually enter questions.");
      }
      throw new Error("Failed to parse questions from the PDF content. Please try again.");
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
    }));

    console.log(`Successfully parsed ${questions.length} questions from PDF with explanations`);

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
