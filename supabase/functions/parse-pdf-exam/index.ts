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

    // Build the messages array with PDF as inline data for vision model
    const messages: any[] = [
      {
        role: "system",
        content: `You are an expert exam parser and educational content creator. Your task is to:
1. Extract all questions from the PDF document exactly as they appear
2. Identify the question type (multiple_choice, true_false, or short_answer)
3. Extract all answer options for multiple choice questions
4. Identify the correct answer from the solutions provided
5. Extract the solution/working if provided
6. Generate a clear, educational explanation for each question that helps students understand:
   - Why the correct answer is right
   - Why other options are wrong (for multiple choice)
   - The key concepts being tested
   - Any helpful tips or mnemonics

IMPORTANT: Return ONLY valid JSON array, no other text. Each question object must have:
- question_text: string (the full question)
- question_type: "multiple_choice" | "true_false" | "short_answer"
- options: string[] (for multiple choice, without A/B/C/D prefixes)
- correct_answer: string (the correct answer text)
- solution: string (the original solution from PDF if available, or empty string)
- explanation: string (your AI-generated educational explanation)`
      }
    ];

    // Add the PDF content as base64 for vision processing
    if (hasSeparateSolutions && solutionsPdf) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "I'm providing two PDFs - the first is the exam questions, the second is the solutions. Extract all questions, match them with solutions, and generate helpful explanations."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${questionsPdf}`
            }
          },
          {
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${solutionsPdf}`
            }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all questions from this PDF. If solutions are included, use them. Generate helpful educational explanations for each question."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${questionsPdf}`
            }
          }
        ]
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error("Failed to parse PDF");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    console.log("AI response received, parsing JSON...");

    // Parse the JSON from the response
    let questions: Question[] = [];
    try {
      // Try to find JSON array in the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing the whole content as JSON
        questions = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content.substring(0, 1000));
      throw new Error("Failed to parse questions from PDF");
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
