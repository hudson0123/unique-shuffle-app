'use client';

import { useEffect, useReducer, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CardGrid } from '@/components/CardGrid';
import { PlacedList } from '@/components/PlacedList';
import {
  initialPlacement,
  reducePlacement,
  isComplete,
  placedSet,
  type PlacementState,
} from '@/lib/placementMachine';
import { submitShuffle } from '@/app/actions/submit';

const STORAGE_KEY = 'unique-shuffle:placement-v1';

function loadInitial(): PlacementState {
  if (typeof window === 'undefined') return initialPlacement();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialPlacement();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.placed)) {
      const hydrated = reducePlacement(initialPlacement(), {
        type: 'HYDRATE',
        placed: parsed.placed,
      });
      return hydrated;
    }
  } catch {
    // ignore
  }
  return initialPlacement();
}

export default function Home() {
  const [state, dispatch] = useReducer(reducePlacement, undefined, loadInitial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const wasComplete = useRef(false);

  // Persist on every change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be unavailable; ignore
    }
  }, [state]);

  // When completion is first achieved, scroll the Submit button into view
  useEffect(() => {
    if (isComplete(state) && !wasComplete.current) {
      submitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      wasComplete.current = true;
    }
    if (!isComplete(state)) wasComplete.current = false;
  }, [state]);

  // ⌘Z / Ctrl+Z undo; Backspace removes the most recently placed card
  // unless an editable element has focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' || tag === 'textarea' || tag === 'select';
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }
      if (e.key === 'Backspace' && !isEditable) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onSubmit() {
    if (!isComplete(state)) return;
    setError(null);
    startTransition(async () => {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        const result = await submitShuffle(state.placed);
        router.push(`/result/${result.hash}?via=${result.via}`);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Something went wrong. Please try again.',
        );
      }
    });
  }

  function onClearAll() {
    if (state.placed.length === 0) return;
    const ok = window.confirm('Clear all placed cards?');
    if (ok) dispatch({ type: 'CLEAR' });
  }

  const placedSetRef = placedSet(state);

  return (
    <main className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-4 sm:py-8">
      <header className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Unique Shuffle</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Enter the order of your shuffled deck. Tap the cards in the grid in
          the order they appear from the top of your deck. We&rsquo;ll tell you
          whether this exact shuffle has ever been recorded before.
        </p>
      </header>

      <div className="flex flex-col gap-4 sm:gap-8 lg:flex-row lg:gap-12">
        <section aria-label="Card grid" className="flex-1">
          <CardGrid placed={placedSetRef} onPlace={(c) => dispatch({ type: 'PLACE', card: c })} />
        </section>

        <aside aria-label="Placed cards" className="w-full lg:w-80 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-sm font-medium tabular-nums"
              aria-live="polite"
            >
              {state.placed.length} / 52
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => dispatch({ type: 'UNDO' })}
                disabled={state.placed.length === 0}
                className="text-xs px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-100 disabled:opacity-40"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={onClearAll}
                disabled={state.placed.length === 0}
                className="text-xs px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-100 disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          <button
            ref={submitRef}
            type="button"
            onClick={onSubmit}
            disabled={!isComplete(state) || pending}
            className={"w-full mb-4 py-3 rounded-md bg-zinc-900 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed" + (pending ? " opacity-40 cursor-not-allowed" : " bg-green-600 hover:bg-green-700")}
          >
            {pending ? 'Submitting…' : 'Submit shuffle'}
          </button>

          {error && (
            <p className="text-sm text-rose-600 mb-3" role="alert">
              {error}
            </p>
          )}

          <PlacedList
            placed={state.placed}
            onRemove={(i) => dispatch({ type: 'REMOVE_AT', index: i })}
          />
        </aside>
      </div>
    </main>
  );
}
