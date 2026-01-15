import { useState, useRef, useEffect } from 'react';
import { Question } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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

interface PageRange {
  start: number;
  end: number;
}

async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}

async function extractTextWithPdfJs(
  file: File,
  startPage?: number,
  endPage?: number
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;

  const start = startPage || 1;
  const end = endPage || pdf.numPages;

  let fullText = '';
  for (let pageNum = start; pageNum <= end; pageNum++) {
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
  const [questionsTotalPages, setQuestionsTotalPages] = useState<number | null>(null);
  const [solutionsTotalPages, setSolutionsTotalPages] = useState<number | null>(null);
  const [questionsPageRange, setQuestionsPageRange] = useState<PageRange | null>(null);
  const [solutionsPageRange, setSolutionsPageRange] = useState<PageRange | null>(null);
  const questionsInputRef = useRef<HTMLInputElement>(null);
  const solutionsInputRef = useRef<HTMLInputElement>(null);

  // Detect page count when questions PDF is uploaded
  useEffect(() => {
    if (questionsPdf) {
      getPdfPageCount(questionsPdf)
        .then((count) => {
          setQuestionsTotalPages(count);
          setQuestionsPageRange({ start: 1, end: count });
        })
        .catch((err) => {
          console.warn('Failed to get page count:', err);
          setQuestionsTotalPages(null);
          setQuestionsPageRange(null);
        });
    } else {
      setQuestionsTotalPages(null);
      setQuestionsPageRange(null);
    }
  }, [questionsPdf]);

  // Detect page count when solutions PDF is uploaded
  useEffect(() => {
    if (solutionsPdf) {
      getPdfPageCount(solutionsPdf)
        .then((count) => {
          setSolutionsTotalPages(count);
          setSolutionsPageRange({ start: 1, end: count });
        })
        .catch((err) => {
          console.warn('Failed to get page count:', err);
          setSolutionsTotalPages(null);
          setSolutionsPageRange(null);
        });
    } else {
      setSolutionsTotalPages(null);
      setSolutionsPageRange(null);
    }
  }, [solutionsPdf]);

  const handleQuestionsPageRangeChange = (field: 'start' | 'end', value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) return;
    if (questionsTotalPages && numValue > questionsTotalPages) return;

    setQuestionsPageRange((prev) => ({
      start: field === 'start' ? numValue : prev?.start || 1,
      end: field === 'end' ? numValue : prev?.end || questionsTotalPages || 1,
    }));
  };

  const handleSolutionsPageRangeChange = (field: 'start' | 'end', value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) return;
    if (solutionsTotalPages && numValue > solutionsTotalPages) return;

    setSolutionsPageRange((prev) => ({
      start: field === 'start' ? numValue : prev?.start || 1,
      end: field === 'end' ? numValue : prev?.end || solutionsTotalPages || 1,
    }));
  };

  const parsePDFs = async () => {
    if (!questionsPdf) {
      toast.error('Please upload at least the questions PDF');
      return;
    }

    // Validate page ranges
    if (questionsPageRange && questionsPageRange.start > questionsPageRange.end) {
      toast.error('Invalid page range for questions PDF');
      return;
    }
    if (solutionsPageRange && solutionsPageRange.start > solutionsPageRange.end) {
      toast.error('Invalid page range for solutions PDF');
      return;
    }

    setLoading(true);
    try {
      // Prefer robust client-side text extraction (works for most text PDFs)
      let questionsText = '';
      let solutionsText: string | null = null;

      try {
        questionsText = await extractTextWithPdfJs(
          questionsPdf,
          questionsPageRange?.start,
          questionsPageRange?.end
        );
        solutionsText = solutionsPdf
          ? await extractTextWithPdfJs(
              solutionsPdf,
              solutionsPageRange?.start,
              solutionsPageRange?.end
            )
          : null;
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

          {/* Page range selector for questions PDF */}
          {questionsPdf && questionsTotalPages !== null && questionsTotalPages > 1 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Parse pages</span>
              <Input
                type="number"
                min={1}
                max={questionsTotalPages}
                value={questionsPageRange?.start || 1}
                onChange={(e) => handleQuestionsPageRangeChange('start', e.target.value)}
                className="h-8 w-16 text-center"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="number"
                min={1}
                max={questionsTotalPages}
                value={questionsPageRange?.end || questionsTotalPages}
                onChange={(e) => handleQuestionsPageRangeChange('end', e.target.value)}
                className="h-8 w-16 text-center"
              />
              <span className="text-muted-foreground">of {questionsTotalPages} pages</span>
            </div>
          )}
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

          {/* Page range selector for solutions PDF */}
          {solutionsPdf && solutionsTotalPages !== null && solutionsTotalPages > 1 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Parse pages</span>
              <Input
                type="number"
                min={1}
                max={solutionsTotalPages}
                value={solutionsPageRange?.start || 1}
                onChange={(e) => handleSolutionsPageRangeChange('start', e.target.value)}
                className="h-8 w-16 text-center"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="number"
                min={1}
                max={solutionsTotalPages}
                value={solutionsPageRange?.end || solutionsTotalPages}
                onChange={(e) => handleSolutionsPageRangeChange('end', e.target.value)}
                className="h-8 w-16 text-center"
              />
              <span className="text-muted-foreground">of {solutionsTotalPages} pages</span>
            </div>
          )}

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
