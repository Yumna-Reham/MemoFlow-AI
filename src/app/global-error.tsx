'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: '#090C15', color: '#F8FAFC', fontFamily: 'sans-serif', padding: '2rem' }}>
        <div style={{ maxWidth: '500px', margin: '100px auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Application Error</h2>
          <p style={{ color: '#94A3B8', fontSize: '0.875rem', margin: '1rem 0' }}>
            {error?.message || 'A critical rendering error occurred.'}
          </p>
          <button
            onClick={() => reset()}
            style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#8B5CF6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
