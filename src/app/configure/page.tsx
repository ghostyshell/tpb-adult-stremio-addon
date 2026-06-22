import { ConfigureApp } from '../../components/configure/ConfigureApp';
import { getConfigureProps } from '../../lib/configureProps';

export default function ConfigurePage() {
  const props = getConfigureProps();
  return <ConfigureApp {...props} />;
}
