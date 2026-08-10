"use client";

import { CalendarDays } from "lucide-react";
import type { InputHTMLAttributes, KeyboardEvent } from "react";
import { useId, useLayoutEffect, useRef } from "react";
import {
  formatDateInput,
  getDateInputCaretPosition,
  toDisplayDate,
  toIsoDate
} from "@/lib/date-input";

type DateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "maxLength" | "onChange" | "type" | "value"
> & {
  calendarLabel?: string;
  error?: boolean | string;
  onChange: (value: string) => void;
  onPickerChange?: (value: string) => void;
  value: string;
};

function countDigits(value: string) {
  return value.replace(/\D/g, "").length;
}

export function DateInput({
  "aria-describedby": ariaDescribedBy,
  calendarLabel = "Choose date",
  className,
  disabled,
  error,
  onChange,
  onKeyDown: onKeyDownProp,
  onPickerChange,
  value,
  ...inputProps
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const pendingCaretDigits = useRef<number | null>(null);
  const isInvalid = Boolean(error);
  const errorId = useId();
  const describedBy = [
    ariaDescribedBy,
    typeof error === "string" ? errorId : undefined
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  useLayoutEffect(() => {
    const nextCaretDigits = pendingCaretDigits.current;
    const input = inputRef.current;
    if (nextCaretDigits === null || !input || document.activeElement !== input) {
      return;
    }

    const nextPosition = getDateInputCaretPosition(value, nextCaretDigits);
    input.setSelectionRange(nextPosition, nextPosition);
    pendingCaretDigits.current = null;
  }, [value]);

  function applyValue(nextRawValue: string, nextCaretDigits: number) {
    pendingCaretDigits.current = nextCaretDigits;
    onChange(formatDateInput(nextRawValue));
  }

  function handleChange(nextValue: string, selectionStart: number | null) {
    const safeSelectionStart = selectionStart ?? nextValue.length;
    applyValue(nextValue, countDigits(nextValue.slice(0, safeSelectionStart)));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDownProp?.(event);
    if (event.defaultPrevented) return;

    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    if (selectionStart !== selectionEnd) return;

    if (event.key === "Backspace" && value[selectionStart - 1] === "/") {
      event.preventDefault();
      const digits = value.replace(/\D/g, "");
      const digitIndex = countDigits(value.slice(0, selectionStart - 1)) - 1;
      if (digitIndex < 0) return;
      applyValue(
        `${digits.slice(0, digitIndex)}${digits.slice(digitIndex + 1)}`,
        digitIndex
      );
    }

    if (event.key === "Delete" && value[selectionStart] === "/") {
      event.preventDefault();
      const digits = value.replace(/\D/g, "");
      const digitIndex = countDigits(value.slice(0, selectionStart));
      applyValue(
        `${digits.slice(0, digitIndex)}${digits.slice(digitIndex + 1)}`,
        digitIndex
      );
    }
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker || disabled) return;

    const pickerWithShowPicker = picker as HTMLInputElement & {
      showPicker?: () => void;
    };
    if (pickerWithShowPicker.showPicker) {
      pickerWithShowPicker.showPicker();
      return;
    }
    picker.click();
  }

  return (
    <span
      className={`date-input${isInvalid ? " is-invalid" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <input
        {...inputProps}
        aria-describedby={describedBy}
        aria-invalid={isInvalid || undefined}
        className="date-input-text"
        disabled={disabled}
        inputMode="numeric"
        maxLength={10}
        onChange={(event) => handleChange(event.target.value, event.target.selectionStart)}
        onKeyDown={handleKeyDown}
        placeholder="DD/MM/YYYY"
        ref={inputRef}
        type="text"
        value={value}
      />
      <button
        aria-label={calendarLabel}
        className="date-input-picker-button"
        disabled={disabled}
        onClick={openPicker}
        type="button"
      >
        <CalendarDays aria-hidden size={16} />
      </button>
      <input
        aria-hidden="true"
        className="date-input-native-picker"
        disabled={disabled}
        onChange={(event) => {
          const nextValue = toDisplayDate(event.target.value);
          onChange(nextValue);
          onPickerChange?.(nextValue);
        }}
        ref={pickerRef}
        tabIndex={-1}
        type="date"
        value={toIsoDate(value) ?? ""}
      />
      {typeof error === "string" ? (
        <span className="date-input-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
