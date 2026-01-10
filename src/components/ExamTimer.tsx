import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExamTimerProps {
  timeLimitMinutes: number;
  onTimeUp: () => void;
  startedAt: Date;
}

export function ExamTimer({ timeLimitMinutes, onTimeUp, startedAt }: ExamTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    const endTime = new Date(startedAt.getTime() + timeLimitMinutes * 60 * 1000);

    const updateTimer = () => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        onTimeUp();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [timeLimitMinutes, startedAt, onTimeUp]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isWarning = timeRemaining <= 300 && timeRemaining > 60;
  const isCritical = timeRemaining <= 60;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-4 py-2',
        isCritical && 'animate-pulse-warning border-destructive bg-destructive/10 text-destructive',
        isWarning && 'border-warning bg-warning/10 text-warning',
        !isWarning && !isCritical && 'border-border bg-muted'
      )}
    >
      <Clock className="h-5 w-5" />
      <span className="exam-timer">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
