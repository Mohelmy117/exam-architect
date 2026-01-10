import { useState } from 'react';
import { Question } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, GripVertical, Image } from 'lucide-react';

interface QuestionEditorProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  readOnly?: boolean;
}

export function QuestionEditor({ questions, onChange, readOnly = false }: QuestionEditorProps) {
  const addQuestion = () => {
    const newQuestion: Question = {
      question_text: '',
      question_type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: '',
      solution: '',
      order_index: questions.length,
    };
    onChange([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = questions.map((q, i) => (i === index ? { ...q, ...updates } : q));
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order_index: i }));
    onChange(updated);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const options = [...(questions[qIndex].options || [])];
    options[optIndex] = value;
    updateQuestion(qIndex, { options });
  };

  const addOption = (qIndex: number) => {
    const options = [...(questions[qIndex].options || []), ''];
    updateQuestion(qIndex, { options });
  };

  const removeOption = (qIndex: number, optIndex: number) => {
    const options = (questions[qIndex].options || []).filter((_, i) => i !== optIndex);
    updateQuestion(qIndex, { options });
  };

  return (
    <div className="space-y-4">
      {questions.map((question, qIndex) => (
        <Card key={qIndex} className="question-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Question {qIndex + 1}</CardTitle>
              </div>
              {!readOnly && (
                <Button variant="ghost" size="icon" onClick={() => removeQuestion(qIndex)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Question Text</Label>
              <Textarea
                value={question.question_text}
                onChange={(e) => updateQuestion(qIndex, { question_text: e.target.value })}
                placeholder="Enter your question..."
                disabled={readOnly}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select
                  value={question.question_type}
                  onValueChange={(value: Question['question_type']) =>
                    updateQuestion(qIndex, { question_type: value })
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Image URL (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={question.image_url || ''}
                    onChange={(e) => updateQuestion(qIndex, { image_url: e.target.value })}
                    placeholder="https://..."
                    disabled={readOnly}
                  />
                  {question.image_url && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={question.image_url} target="_blank" rel="noopener noreferrer">
                        <Image className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {question.question_type === 'multiple_choice' && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-2">
                  {(question.options || []).map((option, optIndex) => (
                    <div key={optIndex} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                        placeholder={`Option ${optIndex + 1}`}
                        disabled={readOnly}
                      />
                      {!readOnly && (question.options || []).length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(qIndex, optIndex)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <Button variant="outline" size="sm" onClick={() => addOption(qIndex)}>
                      <Plus className="mr-1 h-4 w-4" /> Add Option
                    </Button>
                  )}
                </div>
              </div>
            )}

            {question.question_type === 'true_false' && (
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Select
                  value={question.correct_answer}
                  onValueChange={(value) => updateQuestion(qIndex, { correct_answer: value })}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select correct answer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="True">True</SelectItem>
                    <SelectItem value="False">False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {question.question_type !== 'true_false' && (
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Input
                  value={question.correct_answer}
                  onChange={(e) => updateQuestion(qIndex, { correct_answer: e.target.value })}
                  placeholder={
                    question.question_type === 'multiple_choice'
                      ? 'Enter the correct option text'
                      : 'Enter the correct answer'
                  }
                  disabled={readOnly}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Solution/Explanation (optional)</Label>
              <Textarea
                value={question.solution || ''}
                onChange={(e) => updateQuestion(qIndex, { solution: e.target.value })}
                placeholder="Explain why this is the correct answer..."
                disabled={readOnly}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {!readOnly && (
        <Button onClick={addQuestion} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Add Question
        </Button>
      )}
    </div>
  );
}
