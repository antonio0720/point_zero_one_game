/**
 * Partner Portal Home Component
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

interface Props {}

const PartnerPage: React.FC<Props> = () => {
  const { t } = useTranslation();

  return (
    <div className="partner-page">
      <h1>{t('Welcome to Point Zero One Digital')}</h1>

      <section className="tenant-selection">
        <h2>{t('Select your tenant')}</h2>
        {/* Render tenant selection UI */}
      </section>

      <section className="quick-metrics">
        <h2>{t('Quick Metrics')}</h2>
        {/* Render quick metrics UI */}
      </section>

      <section className="setup-checklist">
        <h2>{t('Setup Checklist')}</h2>
        {/* Render setup checklist UI */}
      </section>
    </div>
  );
};

export default PartnerPage;
