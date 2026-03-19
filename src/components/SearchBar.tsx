import { useState, useRef, useMemo, useCallback } from "react";
import { Search, X, CalendarSearch } from "lucide-react";
import { format, subMonths, startOfMonth, getDaysInMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRange {
  from: Date;
  to: Date;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  dateRange?: DateRange | null;
  onDateRangeChange?: (range: DateRange | null) => void;
}

/** A single scrollable date segment (year, month, or day) */
const ScrollSegment = ({
  value,
  min,
  max,
  pad,
  onChange,
  suffix = "",
}: {
  value: number;
  min: number;
  max: number;
  pad: number;
  onChange: (v: number) => void;
  suffix?: string;
}) => {
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -1 : 1;
      let next = value + delta;
      if (next > max) next = min;
      if (next < min) next = max;
      onChange(next);
    },
    [value, min, max, onChange]
  );

  return (
    <span
      onWheel={handleWheel}
      className="cursor-ns-resize select-none hover:bg-primary/20 rounded px-0.5 transition-colors"
      title="스크롤로 변경"
    >
      {String(value).padStart(pad, "0")}{suffix}
    </span>
  );
};

/** Scrollable date display: YYYY/MM/DD */
const ScrollableDate = ({
  date,
  onChange,
  placeholder = "YYYY/MM/DD",
  isActive,
}: {
  date: Date | undefined;
  onChange: (d: Date) => void;
  placeholder?: string;
  isActive: boolean;
}) => {
  if (!date) {
    return (
      <span className={cn("px-2 py-1 rounded text-xs", isActive ? "bg-muted ring-1 ring-primary/30" : "bg-muted text-muted-foreground")}>
        {placeholder}
      </span>
    );
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const maxDay = getDaysInMonth(date);
  const today = new Date();

  const updateDate = (y: number, m: number, d: number) => {
    const daysInMonth = getDaysInMonth(new Date(y, m - 1));
    const safeDay = Math.min(d, daysInMonth);
    const newDate = new Date(y, m - 1, safeDay);
    if (newDate <= today) {
      onChange(newDate);
    }
  };

  return (
    <span className={cn(
      "px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-0",
      "bg-primary/10 text-primary"
    )}>
      <ScrollSegment value={year} min={2020} max={today.getFullYear()} pad={4} onChange={(v) => updateDate(v, month, day)} />
      <span>/</span>
      <ScrollSegment value={month} min={1} max={12} pad={2} onChange={(v) => updateDate(year, v, day)} />
      <span>/</span>
      <ScrollSegment value={day} min={1} max={maxDay} pad={2} onChange={(v) => updateDate(year, month, v)} />
    </span>
  );
};

const SearchBar = ({ value, onChange, dateRange, onDateRangeChange }: SearchBarProps) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>(dateRange?.from);
  const [tempTo, setTempTo] = useState<Date | undefined>(dateRange?.to);
  const [selectingStep, setSelectingStep] = useState<"from" | "to">("from");
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const months = useMemo(() => {
    const result: Date[] = [];
    for (let i = 11; i >= 0; i--) {
      result.push(startOfMonth(subMonths(today, i)));
    }
    return result;
  }, []);

  const handleOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (open) {
      setTempFrom(dateRange?.from);
      setTempTo(dateRange?.to);
      setSelectingStep("from");
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
    }
  };

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    if (selectingStep === "from") {
      setTempFrom(day);
      setTempTo(undefined);
      setSelectingStep("to");
    } else {
      if (tempFrom && day < tempFrom) {
        setTempFrom(day);
        setTempTo(tempFrom);
      } else {
        setTempTo(day);
      }
    }
  };

  const handleApply = () => {
    if (tempFrom && tempTo) {
      onDateRangeChange?.({ from: tempFrom, to: tempTo });
      setPopoverOpen(false);
    }
  };

  const formatRange = (range: DateRange) => {
    return `${format(range.from, "yyyy/MM/dd")} ~ ${format(range.to, "yyyy/MM/dd")}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="키워드로 검색..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="pl-10 pr-8 h-10 bg-muted/50 border-0 focus-visible:ring-1"
          />
          {value && (
            <button
              onClick={() => onChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-10 w-10 shrink-0 border-0 bg-muted/50",
                dateRange && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              <CalendarSearch className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            {/* Header with scrollable date segments */}
            <div className="p-3 border-b space-y-2">
              <p className="text-sm font-medium text-foreground">
                {selectingStep === "from" ? "시작일 선택" : "종료일 선택"}
              </p>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ScrollableDate
                  date={tempFrom}
                  onChange={(d) => { setTempFrom(d); setSelectingStep("to"); }}
                  isActive={selectingStep === "from"}
                />
                <span className="text-xs">~</span>
                <ScrollableDate
                  date={tempTo}
                  onChange={(d) => setTempTo(d)}
                  isActive={selectingStep === "to"}
                />
                <span className="text-[10px] text-muted-foreground/60 ml-1">↕ 스크롤</span>
              </div>
            </div>

            {/* Scrollable multi-month calendar */}
            <div
              ref={scrollRef}
              className="h-[320px] overflow-y-auto"
            >
              {months.map((month, idx) => (
                <div key={idx} data-month-block>
                  <Calendar
                    mode="single"
                    month={month}
                    selected={selectingStep === "from" ? tempFrom : tempTo}
                    onSelect={handleDaySelect}
                    disabled={(date) => date > new Date()}
                    disableNavigation
                    modifiers={{
                      range_start: tempFrom ? [tempFrom] : [],
                      range_end: tempTo ? [tempTo] : [],
                      in_range: tempFrom && tempTo
                        ? Array.from(
                            { length: Math.max(0, Math.ceil((tempTo.getTime() - tempFrom.getTime()) / (1000 * 60 * 60 * 24)) - 1) },
                            (_, i) => {
                              const d = new Date(tempFrom);
                              d.setDate(d.getDate() + i + 1);
                              return d;
                            }
                          )
                        : [],
                    }}
                    modifiersStyles={{
                      range_start: { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderRadius: "50%" },
                      range_end: { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderRadius: "50%" },
                      in_range: { backgroundColor: "hsl(var(--primary) / 0.1)", borderRadius: "0" },
                    }}
                    locale={ko}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </div>
              ))}
            </div>

            <div className="p-3 border-t flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTempFrom(undefined);
                  setTempTo(undefined);
                  setSelectingStep("from");
                }}
              >
                초기화
              </Button>
              <Button
                size="sm"
                disabled={!tempFrom || !tempTo}
                onClick={handleApply}
              >
                적용
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {dateRange && (
        <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg px-3 py-2">
          <CalendarSearch className="h-3.5 w-3.5" />
          <span className="font-medium">{formatRange(dateRange)}</span>
          <span className="text-muted-foreground">기간 필터 적용 중</span>
          <button
            onClick={() => onDateRangeChange?.(null)}
            className="ml-auto text-muted-foreground hover:text-foreground text-xs underline"
          >
            해제
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
