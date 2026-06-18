import { Fragment } from 'react';
import { Link } from 'react-router-dom';

export interface ProjectPathSegment {
  id: string;
  title: string;
}

/**
 * An action's ancestor project path rendered as ' › '-separated **links** to each
 * project (mirrors the project workbench breadcrumb). Renders nothing for a top-level
 * action. `stopPropagation` so a click navigates without triggering the row's handlers.
 */
export function ProjectPathLinks({ path, className }: { path: ProjectPathSegment[]; className?: string }) {
  if (path.length === 0) return null;
  return (
    <p className={className}>
      {path.map((seg, i) => (
        <Fragment key={seg.id}>
          {i > 0 && ' › '}
          <Link
            to={`/projects/${seg.id}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:text-foreground hover:underline"
          >
            {seg.title}
          </Link>
        </Fragment>
      ))}
    </p>
  );
}
