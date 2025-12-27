import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps {
    id: string;
    children: React.ReactNode;
    disabled?: boolean;
}

export const SortableRow: React.FC<SortableRowProps> = ({ id, children, disabled }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
        disabled
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 'auto',
        position: isDragging ? 'relative' as const : undefined,
        opacity: isDragging ? 0.8 : 1,
        boxShadow: isDragging ? '0 5px 15px rgba(0,0,0,0.15)' : 'none',
        background: isDragging ? 'var(--background-card, white)' : undefined
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`group hover:bg-background-light dark:hover:bg-surface-dark-elevated/40 transition-all ${isDragging ? 'bg-background-light dark:bg-surface-dark-elevated/60' : ''}`}
        >
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child) && (child.type as any).displayName === 'DragHandleCell') {
                    return React.cloneElement(child, {
                        // @ts-ignore
                        ...attributes,
                        // @ts-ignore
                        ...listeners,
                        className: `${child.props.className || ''} cursor-grab active:cursor-grabbing touch-none`
                    });
                }
                return child;
            })}
        </tr>
    );
};

// Helper component to identify where the handle is
export const DragHandleCell: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ children, ...props }) => {
    return <td {...props}>{children}</td>;
};
// Add display name for identification
(DragHandleCell as any).displayName = 'DragHandleCell';
