import { RARITY_PARAGRAPH } from '@/lib/constants';

type Props =
  | { kind: 'new'; submissionNumber: number }
  | { kind: 'match'; originalNumber: number; originalDate: Date }
  | { kind: 'permalink'; submissionNumber: number; recordedDate: Date };

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function VerdictBanner(props: Props) {
  let headline: string;
  let sub: string;

  if (props.kind === 'new') {
    headline = 'Never seen before.';
    sub = `You are the ${props.submissionNumber.toLocaleString()}${ordinalSuffix(
      props.submissionNumber,
    )} shuffle ever recorded.`;
  } else if (props.kind === 'match') {
    headline = 'This exact shuffle has been submitted before.';
    sub = `Originally recorded on ${formatDate(props.originalDate)}, submission #${props.originalNumber.toLocaleString()}.`;
  } else {
    headline = `Shuffle #${props.submissionNumber.toLocaleString()}.`;
    sub = `Recorded on ${formatDate(props.recordedDate)}.`;
  }

  return (
    <section className="mb-8">
      <h1 className="text-3xl font-semibold tracking-tight">{headline}</h1>
      <p className="text-zinc-600 mt-1">{sub}</p>
      <p className="text-sm text-zinc-500 mt-4 leading-relaxed">
        {RARITY_PARAGRAPH}
      </p>
    </section>
  );
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
