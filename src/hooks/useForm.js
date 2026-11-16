import { useState, useCallback } from "react";

export default function useForm(initialValues = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback((field) => (e) => {
    const value = e?.target?.value ?? e;
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const setValue = useCallback((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const touch = useCallback((field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const touchAll = useCallback(() => {
    const all = {};
    Object.keys(values).forEach((k) => (all[k] = true));
    setTouched(all);
  }, [values]);

  const validate = useCallback(
    (rules = {}) => {
      const errs = {};
      Object.entries(rules).forEach(([field, validators]) => {
        const val = values[field] ?? "";
        for (const fn of [].concat(validators)) {
          const msg = fn(val, values);
          if (msg) {
            errs[field] = msg;
            break;
          }
        }
      });
      setErrors(errs);
      return Object.keys(errs).length === 0;
    },
    [values],
  );

  const reset = useCallback((next = initialValues) => {
    setValues(next);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setIsSubmitting,
    updateField,
    setValue,
    touch,
    touchAll,
    validate,
    reset,
  };
}

export const required = (label) => (v) =>
  !v || (typeof v === "string" && !v.trim()) ? `${label} is required` : null;

export const minLength = (label, n) => (v) =>
  v && v.length < n ? `${label} must be at least ${n} characters` : null;

export const isEmail = (v) =>
  v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Invalid email address" : null;

export const isPhone = (v) =>
  v && v.replace(/\D/g, "").length < 10 ? "Phone must have at least 10 digits" : null;
