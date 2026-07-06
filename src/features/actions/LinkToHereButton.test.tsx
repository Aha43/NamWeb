import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { ToastContext, type ToastOptions } from '@/components/ui/toast/toast-context';
import { LinkToHereButton } from './LinkToHereButton';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

const doc: WorkspaceDocument = {
  formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
  nodes: {
    root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
    inbox: node('inbox'),
    projects: node('projects', { childIds: ['p1'] }),
    actions: node('actions'),
    p1: node('p1', { title: 'Home', project: true, childIds: ['host', 'other'] }),
    host: node('host', { title: 'This card', status: 'NEXT' }),
    other: node('other', { title: 'Other card', status: 'NEXT' }),
  },
  registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
};

describe('LinkToHereButton (#659)', () => {
  it('picking another action creates the link on it, and the toast offers Link back', () => {
    const dispatch = vi.fn();
    const toasts: ToastOptions[] = [];
    const onLinkBack = vi.fn();
    render(
      <WorkspaceContext.Provider value={{ document: doc, dispatch } as unknown as UseWorkspace}>
        <ToastContext.Provider value={{ toast: (o) => toasts.push(o) }}>
          <LinkToHereButton nodeId="host" onLinkBack={onLinkBack} />
        </ToastContext.Provider>
      </WorkspaceContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Link another action here…' }));
    fireEvent.click(screen.getByRole('button', { name: /Home/ }));
    fireEvent.click(screen.getByRole('button', { name: /Other card/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Link$/ }));

    // The link lands on the picked card, pointing here — committed immediately.
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'updateResources',
        id: 'other',
        resources: [{ type: 'URI', value: 'nam://action/host', description: null }],
      }),
    );
    // The toast offers the reverse link, delegated to the hosting dialog's buffer.
    expect(toasts).toHaveLength(1);
    expect(toasts[0].actionLabel).toBe('Link back');
    toasts[0].onAction?.();
    expect(onLinkBack).toHaveBeenCalledWith('other');
  });

  it('Link back no-ops when the picked action vanished during the toast window (#665)', () => {
    const toasts: ToastOptions[] = [];
    const onLinkBack = vi.fn();
    render(
      <WorkspaceContext.Provider value={{ document: doc, dispatch: vi.fn() } as unknown as UseWorkspace}>
        <ToastContext.Provider value={{ toast: (o) => toasts.push(o) }}>
          <LinkToHereButton nodeId="host" onLinkBack={onLinkBack} />
        </ToastContext.Provider>
      </WorkspaceContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Link another action here…' }));
    fireEvent.click(screen.getByRole('button', { name: /Home/ }));
    fireEvent.click(screen.getByRole('button', { name: /Other card/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Link$/ }));
    // The picked action disappears before the toast is clicked.
    const saved = doc.nodes['other'];
    delete doc.nodes['other'];
    toasts[0].onAction?.();
    expect(onLinkBack).not.toHaveBeenCalled();
    doc.nodes['other'] = saved;
  });

  it('the host card itself is not offered in the picker', () => {
    render(
      <WorkspaceContext.Provider value={{ document: doc, dispatch: vi.fn() } as unknown as UseWorkspace}>
        <LinkToHereButton nodeId="host" />
      </WorkspaceContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Link another action here…' }));
    fireEvent.click(screen.getByRole('button', { name: /Home/ }));
    // 'This card' is listed (browsable) but greyed — not a valid target.
    expect(screen.getByRole('button', { name: 'This card' })).toHaveAttribute('aria-disabled', 'true');
  });
});
