import { useState, useRef } from 'react';
import { Question } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PDFExamParserProps {
  onQuestionsGenerated: (questions: Question[]) => void;
}

async function extractTextWithPdfJs(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ');

    fullText += `${pageText}\n\n`;
  }

  return fullText.trim();
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
  });
};

export function PDFExamParser({ onQuestionsGenerated }: PDFExamParserProps) {
  const [questionsPdf, setQuestionsPdf] = useState<File | null>(null);
  const [solutionsPdf, setSolutionsPdf] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const questionsInputRef = useRef<HTMLInputElement>(null);
  const solutionsInputRef = useRef<HTMLInputElement>(null);

  const parsePDFs = async () => {
    if (!questionsPdf) {
      toast.error('Please upload at least the questions PDF');
      return;
    }

    setLoading(true);
    try {
      // Prefer robust client-side text extraction (works for most text PDFs)
      let questionsText = '';
      let solutionsText: string | null = null;

      try {
        questionsText = await extractTextWithPdfJs(questionsPdf);
        solutionsText = solutionsPdf ? await extractTextWithPdfJs(solutionsPdf) : null;
      } catch (e) {
        console.warn('PDF.js extraction failed, falling back to base64 upload:', e);
      }

      const body: any = {
        hasSeparateSolutions: !!solutionsPdf,
      };

      if (questionsText) body.questionsText = questionsText;
      if (solutionsText) body.solutionsText = solutionsText;

      // Fallback for image-based/protected PDFs (server will try best-effort extraction)
      if (!questionsText) body.questionsPdf = await fileToBase64(questionsPdf);
      if (solutionsPdf && !solutionsText) body.solutionsPdf = await fileToBase64(solutionsPdf);

      const { data, error } = await supabase.functions.invoke('parse-pdf-exam', { body });

      if (error) throw error;

      if (data.questions && data.questions.length > 0) {
        onQuestionsGenerated(data.questions);
        toast.success(`Parsed ${data.questions.length} questions from PDF`);
        setQuestionsPdf(null);
        setSolutionsPdf(null);
      } else {
        toast.error('No questions could be extracted from the PDF');
      }
    } catch (error) {
      console.error('Error parsing PDF:', error);
      toast.error('Failed to parse PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          AI Agent to Create Exam from PDF
        </CardTitle>
        <CardDescription>
          Upload a PDF exam and our AI will extract questions, identify correct answers, and generate helpful explanations for each question.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Questions PDF (required)</Label>
          <div className="flex items-center gap-2">
            <input
              ref={questionsInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setQuestionsPdf(e.target.files?.[0] || null)}
            />
            {questionsPdf ? (
              <div className="flex flex-1 items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
                <span className="truncate text-sm">{questionsPdf.name}</span>
                <Button variant="ghost" size="icon" onClick={() => setQuestionsPdf(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => questionsInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Questions PDF
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Solutions PDF (optional)</Label>
          <div className="flex items-center gap-2">
            <input
              ref={solutionsInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setSolutionsPdf(e.target.files?.[0] || null)}
            />
            {solutionsPdf ? (
              <div className="flex flex-1 items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
                <span className="truncate text-sm">{solutionsPdf.name}</span>
                <Button variant="ghost" size="icon" onClick={() => setSolutionsPdf(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => solutionsInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Solutions PDF
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            If your questions and solutions are in the same PDF, just upload it as the Questions PDF.
          </p>
        </div>

        <Button onClick={parsePDFs} disabled={loading || !questionsPdf} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Parsing PDF...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Parse PDF
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
