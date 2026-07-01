import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-md py-8 text-center text-sm text-muted-foreground">
      <p>{t('notFound.nothing')}</p>
      <Link to="/inbox" className="mt-3 inline-block font-medium text-primary hover:underline">
        {t('notFound.goInbox')}
      </Link>
    </section>
  );
}
