import { useState, useEffect, useCallback } from "react";

const TOAST_DURATION = 4000;
let listeners = [];
let toasts = [];
let nextId = 1;

function notify() {
  listeners.forEach(fn => fn([...toasts]));
}

export function toast({ title, description, variant, duration = TOAST_DURATION }) {
  const id = nextId++;
  const t = { id, title, description, variant, duration };
  toasts = [t, ...toasts].slice(0, 5);
  notify();
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

export function dismiss(id) {
  toasts = id ? toasts.filter(t => t.id !== id) : [];
  notify();
}

export function useToast() {
  const [state, setState] = useState([...toasts]);

  useEffect(() => {
    listeners.push(setState);
    return () => { listeners = listeners.filter(fn => fn !== setState); };
  }, []);

  return {
    toasts: state,
    toast,
    dismiss,
  };
}