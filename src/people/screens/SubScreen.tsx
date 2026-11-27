import { DocumentScreen } from '../../documents/screens/DocumentScreen';
import { InvoiceStepScreen } from '../../documents/screens/InvoiceSteps';
import type { Sub } from '../../shell/navigation';
import type { Nav } from './common';
import { CustomerForm } from './CustomerForm';
import { CustomerScreen } from './CustomerScreen';
import { JobForm } from './JobForm';
import { JobScreen } from './JobScreen';
import { SiteForm } from './SiteForm';

/** The Customer, Site, Job and Document screens opened over a tab. */
export function SubScreen({ sub, nav }: { sub: Sub; nav: Nav }) {
  switch (sub.screen) {
    case 'customer':
      return <CustomerScreen id={sub.id} nav={nav} />;
    case 'customer-form':
      return <CustomerForm id={sub.id} nav={nav} />;
    case 'site-form':
      return <SiteForm customerId={sub.customerId} id={sub.id} nav={nav} />;
    case 'job-form':
      return <JobForm customerId={sub.customerId} id={sub.id} nav={nav} />;
    case 'job':
      return <JobScreen id={sub.id} nav={nav} />;
    case 'invoice-step':
      return <InvoiceStepScreen step={sub.step} id={sub.id} nav={nav} />;
    case 'document':
      return <DocumentScreen id={sub.id} nav={nav} />;
  }
}
