import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <section className="mx-auto max-w-md py-8 text-center text-sm text-slate-500">
      <p>Nothing here.</p>
      <Link to="/inbox" className="mt-3 inline-block font-medium text-blue-600 hover:underline">
        Go to Inbox
      </Link>
    </section>
  );
}
