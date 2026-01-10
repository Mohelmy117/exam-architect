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

    let prompt = "";
    
    if (hasSeparateSolutions && solutionsPdf) {
      prompt = `I have two PDFs - one with exam questions and one with solutions.

Questions PDF (base64): ${questionsPdf.substring(0, 5000)}...

Solutions PDF (base64): ${solutionsPdf.substring(0, 5000)}...

Extract all questions from the questions PDF and match them with their solutions from the solutions PDF.`;
    } else {
      prompt = `I have a PDF containing exam questions (possibly with solutions included).

PDF content (base64): ${questionsPdf.substring(0, 10000)}...

Extract all questions from this PDF.`;
    }

    prompt += `

For each question, determine:
- question_text: The full question text
- question_type: "multiple_choice" if it has options A/B/C/D, "true_false" if it's true/false, otherwise "short_answer"
- options: Array of options if multiple choice (just the text, without A/B/C/D prefixes)
- correct_answer: The correct answer text
- solution: The explanation if provided

Return a JSON array of questions. Respond ONLY with valid JSON, no other text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert at parsing exam documents. Extract questions accurately and structure them properly. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
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

    // Parse the JSON from the response
    let questions: Question[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content);
      throw new Error("Failed to parse questions from PDF");
    }

    // Add order_index to questions
    questions = questions.map((q, i) => ({
      ...q,
      order_index: i,
    }));

    console.log(`Successfully parsed ${questions.length} questions from PDF`);

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
