import { renderToStaticMarkup } from 'react-dom/server';
import { MetricChip } from '../src/components/primitives/MetricChip';
import { ModalShell } from '../src/components/primitives/ModalShell';

describe('interaction primitives', () => {
  it('renders MetricChip as button when drillable', () => {
    const html = renderToStaticMarkup(
      <MetricChip label="Contributors" value="5" onClick={() => undefined} ariaLabel="Open contributors" />,
    );

    expect(html).toContain('<button');
    expect(html).toContain('Open contributors');
    expect(html).toContain('focus-visible:ring-orange-300/80');
  });

  it('renders MetricChip as static chip without hover affordance class', () => {
    const html = renderToStaticMarkup(<MetricChip label="Posts" value={42} />);

    expect(html).toContain('<span');
    expect(html).toContain('cy-chip-static');
    expect(html).toContain('Posts');
  });

  it('renders ModalShell with dialog semantics and explicit close action', () => {
    const html = renderToStaticMarkup(
      <ModalShell title="Contributor details" onClose={() => undefined}>
        <p>Body</p>
      </ModalShell>,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Close Contributor details');
  });
});
